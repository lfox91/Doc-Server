'use strict';
const cheerio = require( 'cheerio' );
const request = require( 'request' );
const fs = require( 'fs' );
const targz = require( 'tar.gz' );
const zlib = require( 'zlib' );
const path = require( 'path' );
const tar = require( 'tar' );
const SQL = require( 'sql.js' );
const archiver = require( 'archiver' );

let mdnCSS = {
	/*
	* This function goes to kapeli.com, grabs the Javascript link,
	* then attaches it to the req obj
	*/
	download: function ( req, res, next ) {
		request( 'https://kapeli.com/mdn_offline', function ( err, html ) {
			if ( err ) console.log( err );
			let $ = cheerio.load( html.body );

			//Only use the link that contains the text 'Javascript.tgz'
			let CSSdownloadLink = "https://kapeli.com/" + $( ".download:contains('CSS.tgz')" )
				.attr( "href" );
			req.CSSdownloadLink = CSSdownloadLink;
			next();
		} );
	},
	//downloads tar file from kapeli.com
	getCSS: function ( req, res, next ) {
		//NOTE:downloading 22 MB .tar to disk

		let write = fs.createWriteStream( './mdnFiles/css.tgz' );

		///////////////////////////////////////////////////////
		// using the request stream as a ReadStream
		// NOTE: req.CSSdownloadLink initialized in mdn.download
		//////////////////////////////////////////////////////
		let read = request( req.CSSdownloadLink )
			.on( 'error', function ( err ) {
				throw err;
			} )
			.pipe( write );

		//just to log bytes written - not necessary
		let watcher = fs.watch( './mdnFiles/css.tgz' )
			.on( 'change', function () {
				let bytes=(read.bytesWritten/1000000).toFixed(2);
				require('single-line-log').stdout('CSS: ',bytes +' MB');
			});
		//close readStream and watcher
		read.on( 'finish', function () {
			read.close( function(){
				watcher.close();
				next();
			});
		} );
	},
	extract: function ( req, res, next ) {
		console.log( 'extracting...' );
		let inflate = zlib.Unzip();
		let extractor = tar.Extract( {
				path: './docs'
			} )
			.on( 'error', function ( err ) {
				throw err;
			} )
			.on( 'end', function () {
				console.log( 'extracted' );
			} );
		let extracting = fs.createReadStream( './mdnFiles/css.tgz' )
			.on( 'error', function ( err ) {
				throw err;
			} )
			.pipe( inflate )
			.pipe( extractor );
		extracting.on( 'finish', function () {
			next();
		} );
	},
	getObjs: function(req, res, next){
		let base = '/CSS/developer.mozilla.org/en-US/docs/Web/CSS/';
		let $ = cheerio.load(fs.readFileSync('./docs/CSS/developer.mozilla.org/en-US/docs/Web/CSS/Reference.html'));
		let classObj = {};
		let elemObj = {};
		let funcObj = {};
		let typesObj = {};
		let propObj = {};
		let guideObj = {};
		$('div .index a').each((i, el) => {
			let text = $(el).text();
			let link = $(el).attr('href');
			let classReg = new RegExp (/^:[^:].+/g );
			let elemReg = new RegExp (/^::/g );
			let funcReg = new RegExp (/^@|\(\)$/g );
			let typeReg = new RegExp (/^</g );
			if(classReg.test(text)){
				classObj[text]= base + link;
			}
			else if(elemReg.test(text)){
				elemObj[text] = base + link;
			}
			else if(funcReg.test(text)){
				funcObj[text] = base + link;
			}
			else if ( typeReg.test(text)){
				typesObj[text] = base + link;
			}else{
				propObj[text] = base + link;
			}
		});
		$('div.column-half li a').each((i, el) => {
			guideObj[$(el).text()] = base + $(el).attr('href');
		});
		req.classObj = classObj;
		req.elemObj = elemObj;
		req.funcObj = funcObj;
		req.typesObj = typesObj;
		req.propObj = propObj;
		req.guideObj = guideObj;
		next();
	},
	getMoz : function(req, res, next){
		let base = '/CSS/developer.mozilla.org/en-US/docs/Web/CSS/';
		let $ = cheerio.load(fs.readFileSync('./docs/CSS/developer.mozilla.org/en-US/docs/Web/CSS/Mozilla_Extensions.html'));

		$('div .index a').each((i, el) => {
			let text = $(el).text();
			let link = $(el).attr('href');
			let classReg = new RegExp (/^:[^:].+/g );
			let elemReg = new RegExp (/^::/g );
			if(classReg.test(text)){
				req.classObj[text] = base + link;
			}
			if(elemReg.test(text)){
				req.elemObj[text] = base + link;
			}
		});
		next();
	},
	sqlFile: function ( req, res, next ) {
		let i = 0;
		let objects = {
			Classes:req.classObj ,
			Elements:req.elemObj,
			Functions:req.funcObj ,
			Types:req.typesObj ,
			Properties:req.propObj,
		  Guides:req.guideObj
		};

		let db = new SQL.Database();
		db.run( "CREATE TABLE docsearch (ID int, NAME char, TYPE char, LINK char);" );

		for ( let k in objects ) {
			console.log( k );
			for ( let j in objects[ k ] ) {
				db.run( "INSERT INTO docsearch VALUES (:ID, :NAME, :TYPE, :LINK)", {
					':ID': i++,
					':NAME': j,
					':TYPE': k,
					':LINK': objects[ k ][ j ]
				} );
			}
		}
		let data = db.export();
		let buffer = new Buffer( data );
		fs.writeFileSync( "docs/mdn_css.sqlite", buffer );
		next();
	},
	zip: function ( req, res, next ) {
		let output = fs.createWriteStream( './mdn_css.zip');
		let archive = archiver('zip');

		output.on('close', function() {
		  console.log(archive.pointer() + ' total bytes');
		  console.log('archiver has been finalized and the output file descriptor has closed.');
			next();
		});

		archive.on('error', function(err) {
		  throw err;
		});

		archive.pipe(output);

		archive.bulk([
		  { expand: true, cwd: 'docs/', src: ['**'], dest:'mdn_css.docs' }
		]);

		archive.finalize();
	}
};


module.exports = mdnCSS;

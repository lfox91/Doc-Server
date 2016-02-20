var scraper = require('website-scraper');
var fs = require('fs');
var cheerio = require('cheerio');
var archiver = require('archiver');

var rewrite = require('./rewrite');
var folderHandler = require('./folderHandler');
var parseEntry = require('./parseEntryPoint');

//Specify type of archive - zip or tar
//Constants to be changed or added later with inputs to program
/* Want structure of directory of files to be eg /node.docs/docs/
*  with the sql file in /node.docs
*  and temporary directory to be documentation/
*  so docs/+SCRAPE_DIR+/documents will be DOWNLOAD_DIR
*  BASE_DIR will be docs/SCRAPE_DIR  maybe rename SCRAPE_DIR?
*/
// function(req, res, next)
var scrapeParseWrite = {
    URL_TO_SCRAPE: 'http://nodejs.org/api/',
    SOURCE_NAME: 'Node API',
    CSS_DIR: 'assets',
    JS_DIR: 'assets',
    SCRAPE_DIR: 'node/',
    BASE_DIR: 'docs/'+ this.SCRAPE_DIR,
    DOWNLOAD_DIR: this.BASE_DIR+'documents/',
    //Initialize Archiver


    createZip: function(req, res, next){
        req.archive = archiver('zip');

        //check and create folder to store zip if it doesn't exist
        folderHandler.createFolder('zips/' + this.SCRAPE_DIR);
        //Create output file stream from SCRAPE_DIR
        req.output = fs.createWriteStream(this.SCRAPE_DIR.slice(0,-1)+req.versionNo+'.zip');
        this.scrape(req, res, next);
    },

    scrape: function(req, res, next){
        //Check to see if folder was deleted or not, and if so, delete it
        folderHandler.checkToDelete(this.BASE_DIR);

        /*
        * Initialize scraper and provide URL, directory to store files, subdirectories
        * FOR files, recurse 1 level deep, and then edit files
        */
        scraper.scrape({
          urls: [this.URL_TO_SCRAPE],
          directory: this.DOWNLOAD_DIR,
          subdirectories: [
        		{directory: 'img', extensions: ['.jpg', '.png', '.svg']},
        		{directory: this.JS_DIR, extensions: ['.js']},
        		{directory: this.CSS_DIR, extensions: ['.css']}
        	],
          recursive: true,
          maxDepth: 1
        }).then((data)=>{
            this.getFiles(req, res, next);
        }).catch(console.log);

        //Event listener for end of zipping function - delete folder
        req.output.on('close', function () {
            console.log(req.archive.pointer() + ' total bytes');
            console.log('archiver has been finalized and the output file descriptor has closed.');
            folderHandler.deleteFolderRecursive(this.BASE_DIR);
            req.filePath = req.output.path;
            req.sourceName = this.SOURCE_NAME;
            // res.versionNo = versionNo;
            next();
        });
        // Event listener for archive errors
        req.archive.on('error', function(err){
            throw err;
        });
    },


    //get list of files to change the hrefs for css and js files to exclude beggining / if they have it
    getFiles: function(req, res, next) {
        var list;
        //Get list of files in directory
        fs.readdir(this.DOWNLOAD_DIR, (err, file) => {
            list = file;
            list.forEach((name) => {
                //Add directory name to file name for FS
                name = this.DOWNLOAD_DIR.concat(name);
                //only edit html files
                if(name.match(/\.html$/)){
                    //pass file names off to be read and rewritten
                    this.editFile(req, res, next, name);
                }
            });

            //Since readdir is async, and is also called by parseEntry, we need to promisify it, and
            //send the resolve over
            var p1 = new Promise((resolve, reject)=>{
                parseEntry.allFiles(this.BASE_DIR, this.DOWNLOAD_DIR, resolve, reject);
            });

            p1.then(function(val){
                //Time to zip the file
                //Pipe zip to the output file
                req.archive.pipe(req.output);
                //specify what to zip up (in this case the directory itself) and append them to the zip
                //Make the directory the zip file extracts to to be based on the SCRAPE_DIR
                req.archive.bulk([
                    { expand: true, cwd: this.BASE_DIR, src: ['**'], dest: this.SCRAPE_DIR.slice(0,-1)+'.docs'}
                ]);
                //Finalize archive and prevent further appends
                req.archive.finalize();
            }).catch((val)=>{
                console.log("Promise rejected: ", val);
            });

        });
    },

    editFile: function(req, res, next, file) {
        fs.readFile(file, 'utf-8', (err, data) => {
            //Remove front slash on src and href of js and css file locations
            var newData = data.replace(/href=\"\/(?!\/)/gi, 'href="').
                replace(/src=\"\/(?!\/)/gi, 'src="');
            //Call function to remove extraneous stuff
            newData = rewrite.node(req, res, next, newData);
            //Rewrite file
            fs.writeFile(file, newData, 'utf-8', (err)=>{
                if(err){
                     console.log(err);
                }
            });
        });
    },


};
module.exports = scrapeParseWrite;
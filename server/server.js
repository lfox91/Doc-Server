
'use strict';

const express = require( 'express' );
const bodyParser = require( 'body-parser' );
const path = require( 'path' );
const mongoose = require('mongoose');
const scraper = require('./scraper');
const dbController = require('./controllers/dbController');
const fs = require('fs');
mongoose.connect('mongodb://Doc:tor@ds059215.mongolab.com:59215/doc-tor');
const db = mongoose.connection;
const app = express();

require('dns').lookup(require('os').hostname(), function (err, add, fam) {
  console.log('addr: '+add);
})

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("your db is open");
});

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname,'./../public')));
/////////////////////////////////////////////////
//// Handle requests to our main page(site)
/////////////////////////////////////////////////
app.get('/' , function(req, res){
  console.log("Our website homepage!");
  res.sendFile(path.join(__dirname,'/../public/index.html'));
});


/***** API *****/

/////////////////////////////////////////////////
//// Handle req for node zip
/////////////////////////////////////////////////
app.get('/node', scraper, dbController.addToDB, function(req,res){
  console.log(res.filePath);
  // res.sendFile(path.resolve(res.filePath));
  console.log("sending full html back to client");
});
//////////////////////////////////////////////////
// Handle post to server add zip file update DB
//////////////////////////////////////////////////
app.post('/error', function(req, res){
  console.log("this func is running");
  fs.writeFile('crashReport.txt', req.body, function(){
    console.log('crash report\'s a go');
  });
});
//////////////////////////////////////////////////
// delete zip/or section from server update DB
//////////////////////////////////////////////////
app.delete('/node', function(req, res){

});
/////////////////////////////////////////////////
// handle changes to node update DB
//////////////////////////////////////////////////
app.put('/node', function(req, res){

});

///////////////////////////////////////////////
// Handle requests for data
// (option for multiple sites)
///////////////////////////////////////////////
// app.get('/html', function(req,res){
//   res.sendFile(path.join(__dirname, '/../index.html'));
//   console.log("send full html back to client");
// });

app.listen(3000, function(){
  console.log("Server is listening on port 3000");
});

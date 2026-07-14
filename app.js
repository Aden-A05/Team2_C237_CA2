const express = require('express');
const mysql = require('mysql2');
const app = express();
const multer = require('multer')


const PORT = 3000;

//Multer setup for file uploads : 
const storage = multer.diskStorage({
    destination: (req, file ,cb)=>{
        cb(null, 'public/images');

    },
    filename: (req,file,cb)=>{
        cb(null, file.originalname)
    }
});

const upload = multer({storage:storage})
 
// Create MySQL connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', //Dont need to change
    database: 'histogram_db' //Change based on database
});
 
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));


//enable form processing
app.use(express.urlencoded({
    extended: false
}))

// Added a simple homepage test to see the design of navbar - Raj
app.get('/', (req, res) => {
    res.render('index', {
        activePage: 'home'
    });
});


// Viewing and Displaying of Information - Ka Fai 
app.get('/home', (req, res) => {
    const sql = 'SELECT * FROM histogram_table'
    connection.query(sql, (error, results) => {
        if (error) {
            console.log('Error in viewing information', error)
            res.send('Error retrieving data')
        } else {
            res.render('home', { histogram_table : results })
        } 
        
    })
})

//Aden task 
app.get('/deletePost/:id', (req, res) => {
    const postid = req.params.id
    const sql = 'DELETE FROM histogram_table where postId = ?'
    connection.query(sql,[postId], (error, results) => {
       if (error){
        console.log('Error in trying to delete the post:', error)
        res.redirect('/home')
       };
       
       res.redirect('/home')
     });
});
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

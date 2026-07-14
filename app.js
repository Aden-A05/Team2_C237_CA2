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

//Dayn task: Adding new information
app.post('/addPost', upload.single('image'), (req, res) => {
    const { title, categories, caption } = req.body;
    const image = req.file ? req.file.filename : null; // multer handles file upload

    const sql = 'INSERT INTO histogram_table (title, categories, image, caption) VALUES (?, ?, ?, ?)';
    const values = [title, categories, image, caption];

    connection.query(sql, values, (error, results) => {
        if (error) {
            console.log('Error inserting new post:', error);
            return res.redirect('/');
        }
        console.log('New post added with ID:', results.insertId);
        res.redirect('/');
    });
});

//Aden task 
app.get('/deletePost/:id', (req, res) => {
    const postid = req.params.id
    const sql = 'DELETE FROM histogram_table where postId = ?'
    connection.query(sql,[postid], (error, results) => {
       if (error){
        console.log('Error in trying to delete the post:', error)
        res.redirect('/')
       };
       
       res.redirect('/')
     });
});
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

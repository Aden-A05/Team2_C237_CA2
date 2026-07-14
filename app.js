const express = require('express');
const mysql = require('mysql2');
const app = express();
const multer = require('multer')
const session = require('express-session')
const flash = require('connect-flash')

app.use(session({
    secret:'secret',
    resave: falsse, 
    saveUninitialized:true,
    cookie: {maxAge:1000*60*60*24*7}
}));

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
    host: 'C237-asyraf-mysql.mysql.database.azure.com',
    user: 'c237_011',
    password: 'c237011@2026!', //Dont need to change
    database: 'c237_011_team2_HistogramDb' //Change based on database
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

//Custom middleware to check user authentication
const checkAuthenticated = (req,res,next)=>{
    if(req.session.user){
        return next()
    }else{
        req.flash('error','Please log in to view this resource');
        res.redirect('/login')
    }
}


const checkAdmin = (req,res,next) => {
    if (req.session.user.role === 'admin'){
        return next();
    }else{
        req.flash('error','Access denied');
        res.redirect('/dashboard')
    }
};

//Routes 
// Added a simple homepage test to see the design of navbar - Raj
app.get('/', (req, res) => {
    res.render('index', {
        activePage: 'home'
    });
});

//Dayn task: Adding new information
app.get('/addPost', (req, res) => {
    // Render the addPost.ejs form page
    res.render('addPost', { activePage: 'addPost' });
});

app.post('/addPost', upload.single('image'), (req, res) => {
    const { title, categories, caption } = req.body;
    const image = req.file ? req.file.filename : null; // multer handles file upload

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
    connection.query(sql,[postId], (error, results) => {
       if (error){
        console.log('Error in trying to delete the post:', error)
        res.redirect('/home')
       };
       
       res.redirect('/home')
     });
});
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

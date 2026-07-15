const express = require('express');
const mysql = require('mysql2');
const app = express();
const multer = require('multer')
const session = require('express-session')
const flash = require('connect-flash')

app.use(session({
    secret:'secret',
    resave: false, 
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
    database: 'c237_011_team2_histogramdb', //Change based on database
    ssl: {
        rejectUnauthorized: true
    }
});

app.use(flash())
 
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

//Routes 
// Registering Account - Raj

app.get('/register',(req,res)=>{

    res.render('register');

});



app.post('/register',(req,res)=>{


    const {
        name,
        email,
        password,
        role
    } = req.body;



    const sql = `
    INSERT INTO user_credentials
    (name, email, password, role)
    VALUES (?, ?, SHA1(?), ?)
    `;



    const values = [
        name,
        email,
        password,
        role
    ];



    connection.query(
        sql,
        values,
        (error,result)=>{


            if(error){

                console.log(
                    "Registration Error:",
                    error
                );

                return res.redirect('/register');

            }



            console.log(
                "New user created:",
                result.insertId
            );


            res.redirect('/login');


        }
    );


});
// Log in - Raj
app.get('/',(req,res)=>{

    res.render('login');

});



app.post('/',(req,res)=>{


    const {
        email,
        password
    } = req.body;



    const sql = `
    SELECT *
    FROM user_credentials
    WHERE email = ?
    AND password = SHA1(?)
    `;



    connection.query(
        sql,
        [
            email,
            password
        ],
        (error,result)=>{


            if(error){

                console.log(error);
                return res.redirect('/login');

            }



            if(result.length > 0){


                req.session.user = result[0];


                res.redirect('/home');


            }

            else{


                res.send("Invalid email or password");


            }


        }
    );


});

// Log out - Raj

app.get('/logout',(req,res)=>{

    req.session.destroy();

    res.redirect('/login');

});

// const checkAdmin = (req,res,next) => {
//     if (req.session.user.role === 'admin'){
//         return next();
//     }else{
//         req.flash('error','Access denied');
//         res.redirect('/home')
//     }
// };


// Dayn task: Adding new information
app.get('/addPost', (req, res) => {
    // Render the addPost.ejs form page
    res.render('addPost', { activePage: 'addPost' });
});

app.post('/addPost', upload.single('image'), (req, res) => {
    // Extract data from the form
    const { title, categories, caption } = req.body;
    let image;

    // Handle file upload via Multer
    if (req.file) {
        image = req.file.filename; // store only the filename
    } else {
        image = null; // fallback if no file uploaded
    }

    // SQL insert query
    const sql = 'INSERT INTO histogram_table (title, categories, image, caption) VALUES (?, ?, ?, ?)';
    const values = [title, categories, image, caption];

    // Execute query
    connection.query(sql, values, (error, results) => {
        if (error) {
            console.log('Error inserting new post:', error);
            return res.redirect('/addPost'); // stay on form if error
        }
        console.log('New post added with ID:', results.insertId);
        res.redirect('/'); // redirect to homepage to view posts
    });
});

// Ka Fai Viewing and displaying information
app.get('/home', checkAuthenticated, (req, res) => {
    const sql = 'SELECT * FROM histogram_table'
    connection.query(sql, (error, results) => {
        if (error) {
            console.log('Error in viewing information', error)
            res.send('Error retrieving data')
        } else {
            res.render('home', { histogram_table : results , activePage: 'home',errorMessage: req.flash('error')})
        } 
        
    })
})

//Aden Delete post task 
app.post('/deletePost/:id',checkAuthenticated ,(req, res) => {
    const postid = req.params.id
    const user_role = req.session.user.role
    const user_id = req.session.user.user_id
    
    //SQL statment to delete the post : 
    const sql_2 = 'DELETE FROM histogram_table WHERE postId = ?'

    //SQL statement to extract the post 
    const sql_1 = 'SELECT * FROM histogram_table WHERE postId = ?'
    connection.query(sql_1,[postid], (error, results) => {
    if (error){
        console.log('Error in trying to delete the post:', error)
        return res.redirect('/home')
        }else{
        // check if the post exsits 
        if(results.length === 0){
            req.flash('error','Post not found')
            return res.redirect('/home')        
        }
        const extracted_post = results[0]

        //Variable that stores the result if the user is admin
        const is_admin = user_role === 'admin'
        //variable that store the result if the user is the owner of the post
        const is_owner = user_id === extracted_post.user_id

         if(is_admin === true || is_owner === true ){
         connection.query(sql_2,[postid], (error, results) => {
            if (error){
                console.log('Error in trying to delete the post:', error)
                return res.redirect('/home')
                }else{return res.redirect('/home')} // Redirect user back to home page when the delete operation is successfull
            });
        }else{ //If the user is not the owner of the post and not the admin 
        req.flash('error','You dont have the permission to delete other people post.');
            return res.redirect('/home') }

        };
    });

 
    });

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

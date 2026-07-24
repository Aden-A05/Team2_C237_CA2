const express = require('express');
const mysql = require('mysql2');
const app = express();
const multer = require('multer')
const session = require('express-session')
const flash = require('connect-flash')

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

const PORT = process.env.PORT || 3000;

//Multer setup for file uploads : 
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');

    },
    filename: (req, file, cb) => {
        cb(null, file.originalname)
    }
});

const upload = multer({ storage: storage })



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
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next()
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login')
    }
}

//Routes 
// Log in - Raj
app.get('/', (req, res) => {

    res.render('login');

});



app.post('/', (req, res) => {
    const { email, password } = req.body;

    const sql = `
    SELECT *
    FROM user_credentials
    WHERE email = ?
    AND password = SHA1(?)
    `;

    connection.query(sql, [email, password], (error, result) => {
        if (error) {
            console.log(error);
            return res.redirect('/login');
        }

        if (result.length > 0) {
            req.session.user = result[0];

            // Redirect based on roles - Raj
            if (req.session.user.role === 'admin') {
                res.redirect('/admin/dashboard');
            } else {
                res.redirect('/home');
            }
        } else {
            res.send("Invalid email or password");
        }
    });
});

app.get('/register', (req, res) => {

    res.render('register');

});


// Registering - Raj
app.post('/register', (req, res) => {

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
        (error, result) => {


            if (error) {

                console.log(
                    "Registration Error:",
                    error
                );


                // Duplicate email error - Raj
                if (error.code === 'ER_DUP_ENTRY') {

                    return res.render('register', {
                        error: 'Email already exists. Please use another email.'
                    });

                }


                // Other errors
                return res.render('register', {
                    error: 'Registration failed. Please try again.'
                });

            }



            console.log(
                "New user created:",
                result.insertId
            );


            res.redirect('/');

        }
    );

});

// Log out - Raj

app.get('/logout', (req, res) => {

    req.session.destroy();

    res.redirect('/');

});

const checkAdmin = (req, res, next) => {
    if (!req.session.user) {
        req.flash('error', 'Please log in to view this resource');
        return res.redirect('/login');
    }

    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied. Admins only.');
        return res.redirect('/home');
    }
};


// Dayn task: Adding new information
app.get('/addPost', (req, res) => {
    res.render('add', {
        activePage: 'addPost',
        user: req.session.user,
        errorMessage: req.flash('error')
    });
});

// Add post - Done by dayn
app.post('/addPost', upload.single('image'), (req, res) => {
    const { title, categories, caption } = req.body;
    const image = req.file ? req.file.filename : null;
    const user_id = req.session.user.user_id

    const sql = 'INSERT INTO histogram_table (title, categories, image, caption, user_id, is_approved) VALUES (?, ?, ?, ?, ?, ?)';
    const values = [title, categories, image, caption, user_id, 0];

    connection.query(sql, values, (error, results) => {
        if (error) {
            console.log('Error inserting new post:', error);
            return res.redirect('/home');
        }

        console.log('New post added with ID:', results.insertId);

        // Redirect based on role
        if (req.session.user && req.session.user.role === 'admin') {
            res.redirect('/admin/home');
        } else {
            res.redirect('/home');
        }
    });
});


// Ka Fai Viewing and displaying information
app.get('/home', checkAuthenticated, (req, res) => {
    const sql = ' SELECT h.*, u.name AS posted_by, u.role AS posted_role FROM histogram_table h INNER JOIN user_credentials u ON h.user_id = u.user_id ORDER BY h.postId DESC '
    connection.query(sql, (error, results) => {
        if (error) {
            console.log('Error in viewing information', error)
            res.send('Error retrieving data')
        } else {
            res.render('home', {
                histogram_table: results,
                activePage: 'home',
                user: req.session.user,
                errorMessage: req.flash('error'),
                approvedMessage: req.flash('approved', 'Post has been approved')
            })
        }

    })
})


// Evan - Part 4: Editing existing information

// Display current post information
app.get('/editPost/:id', checkAuthenticated, (req, res) => {
    const postId = req.params.id;

    const sql =
        'SELECT * FROM histogram_table WHERE postId = ?';

    connection.query(sql, [postId], (error, results) => {
        if (error) {
            console.error(
                'Database query error:',
                error.message
            );

            return res.send('Error retrieving post.');
        }

        if (results.length > 0) {
            const post = results[0];

            const isAdmin =
                req.session.user.role === 'admin';

            const isOwner =
                req.session.user.user_id === post.user_id;

            if (isAdmin || isOwner) {
                res.render('editPost', {
                    post: post,
                    activePage: 'editPost',
                    user: req.session.user
                });
            } else {
                res.send(
                    'You do not have permission to edit this post.'
                );
            }
        } else {
            res.send('Post not found');
        }
    });
});


// Update the post information
app.post(
    '/editPost/:id',
    checkAuthenticated,
    upload.single('image'),
    (req, res) => {
        const postId = req.params.id;

        const {
            title,
            categories,
            caption
        } = req.body;

        // Retrieve the current image filename from edit.ejs
        let image = req.body.currentImage;

        // Use the new image if one is uploaded
        if (req.file) {
            image = req.file.filename;
        }

        let sql;
        let values;

        // Admin can update any post
        if (req.session.user.role === 'admin') {
            sql = `
                UPDATE histogram_table
                SET title = ?,
                    categories = ?,
                    image = ?,
                    caption = ?
                WHERE postId = ?
            `;

            values = [
                title,
                categories,
                image,
                caption,
                postId
            ];
        } else {
            // Normal users can update only their own posts
            sql = `
                UPDATE histogram_table
                SET title = ?,
                    categories = ?,
                    image = ?,
                    caption = ?
                WHERE postId = ?
                AND user_id = ?
            `;

            values = [
                title,
                categories,
                image,
                caption,
                postId,
                req.session.user.user_id
            ];
        }

        connection.query(
            sql,
            values,
            (error, results) => {
                if (error) {
                    console.error(
                        'Error updating post:',
                        error
                    );

                    res.send('Error updating post.');
                } else {
                    if (
                        req.session.user.role === 'admin'
                    ) {
                        res.redirect('/admin/home');
                    } else {
                        res.redirect('/home');
                    }
                }
            }
        );
    }
);

//Aden Delete post task 
app.post('/deletePost/:id', checkAuthenticated, (req, res) => {
    const postid = req.params.id
    const user_role = req.session.user.role
    const user_id = req.session.user.user_id

    //SQL statment to delete the post : 
    const sql_2 = 'DELETE FROM histogram_table WHERE postId = ?'

    //SQL statement to extract the post 
    const sql_1 = 'SELECT * FROM histogram_table WHERE postId = ?'
    connection.query(sql_1, [postid], (error, results) => {
        if (error) {
            console.log('Error in trying to delete the post:', error)
            return res.redirect('/home')
        } else {
            // check if the post exsits 
            if (results.length === 0) {
                req.flash('error', 'Post not found')
                return res.redirect('/home')
            }
            const extracted_post = results[0]

            //Variable that stores the result if the user is admin
            const is_admin = user_role === 'admin'
            //variable that store the result if the user is the owner of the post
            const is_owner = user_id === extracted_post.user_id

            if (is_admin === true || is_owner === true) {
                connection.query(sql_2, [postid], (error, results) => {
                    if (error) {
                        console.log('Error in trying to delete the post:', error)
                        if (is_admin) {
                            return res.redirect('/admin/home')
                        } else { return res.redirect('/home') }
                    } else { // Redirect user back to home page when the delete operation is successfull
                        if (is_admin) {
                            return res.redirect('/admin/home')
                        } else { return res.redirect('/home') }
                    }
                });
            } else { //If the user is not the owner of the post and not the admin 
                req.flash('error', 'You dont have the permission to delete other people post.');
                return res.redirect('/admin/dashboard')
            }

        };
    });


});

// Admin Home - view all posts - Done by Ka Fai (Enhancement)
app.get('/admin/home', checkAuthenticated, checkAdmin, (req, res) => {
    const sql = ' SELECT h.*, u.name AS posted_by, u.role AS posted_role FROM histogram_table h INNER JOIN user_credentials u ON h.user_id = u.user_id ORDER BY h.postId DESC '
    connection.query(sql, (error, results) => {
        if (error) {
            console.log('Error in viewing information', error);
            res.send('Error retrieving data');
        } else {
            res.render('home', {
                activePage: 'adminHome',
                histogram_table: results,
                user: req.session.user,
                errorMessage: req.flash('error'),
                approvedMessage: req.flash('approved', 'Post has been approved')

            });
        }
    });
});


// Admin Analytics Dashboard - Done by the team (Enhancement)
app.get('/admin/dashboard', checkAuthenticated, checkAdmin, (req, res) => {
    const sqlApproved = 'SELECT COUNT(postId) AS approvedPosts FROM histogram_table WHERE is_approved = 1';
    const sqlPending = 'SELECT COUNT(postId) AS pendingPosts FROM histogram_table WHERE is_approved = 0';
    const sqlUsers = 'SELECT COUNT(user_id) AS totalUsers FROM user_credentials';
    const sqlCategories = `SELECT categories, COUNT(postId) AS post_count FROM histogram_table WHERE is_approved = 1 GROUP BY categories`;
    const sqlUsersList = `
    SELECT u.name, u.role, COUNT(h.postId) AS post_count
    FROM user_credentials u
    LEFT JOIN histogram_table h ON u.user_id = h.user_id AND h.is_approved = 1
    GROUP BY u.user_id, u.name, u.role
    ORDER BY u.role DESC, u.name ASC
  `;
    const sqlPosts = `
    SELECT h.*, u.name AS posted_by, u.role AS posted_role
    FROM histogram_table h
    JOIN user_credentials u ON h.user_id = u.user_id
    ORDER BY h.postId DESC
  `;

    connection.query(sqlApproved, (err1, approvedResult) => {
        if (err1) return console.log(err1);

        connection.query(sqlPending, (err2, pendingResult) => {
            if (err2) return console.log(err2);

            connection.query(sqlUsers, (err3, usersResult) => {
                if (err3) return console.log(err3);

                connection.query(sqlCategories, (err4, categoriesResult) => {
                    if (err4) return console.log(err4);

                    connection.query(sqlUsersList, (err5, usersList) => {
                        if (err5) return console.log(err5);

                        connection.query(sqlPosts, (err6, postsResult) => {
                            if (err6) return console.log(err6);

                            res.render('home', {
                                activePage: 'adminDashboard',
                                totalPosts: approvedResult[0].approvedPosts,
                                pendingPosts: pendingResult[0].pendingPosts,
                                totalUsers: usersResult[0].totalUsers,
                                categoriesData: categoriesResult,
                                userList: usersList,
                                histogram_table: postsResult, 
                                user: req.session.user,
                                errorMessage: req.flash('error'),
                                approvedMessage: req.flash('approved') || []
                            });
                        });
                    });
                });
            });
        });
    });
});




// Danish's search function
app.get('/searched', checkAuthenticated, (req, res) => {
    // Read the type of search (title/category/user)
    const searchType = req.query.searchType;

    if (searchType === 'title') {
        const titleQuery = req.query.titleQuery;
        const sql = 'SELECT h.*, u.name AS posted_by, u.role AS posted_role FROM histogram_table h INNER JOIN user_credentials u ON h.user_id = u.user_id WHERE h.title like ? ORDER BY h.postId DESC ';
        connection.query(sql, [`${titleQuery}%`], (error, results) => {
            if (error) {
                console.error("Error searching posts:", error);
                return res.status(500).send('Error searching posts');
            }
            res.render('searched', {
                histogram_table: results,
                activePage: 'home',
                user: req.session.user,
                errorMessage: req.flash('error'),
                searchType: searchType,
                titleQuery: titleQuery
            });
        });


    } else if (searchType === 'category') {
        const categoryQuery = req.query.categoryQuery;
        const sql = 'SELECT h.*, u.name AS posted_by, u.role AS posted_role FROM histogram_table h INNER JOIN user_credentials u ON h.user_id = u.user_id WHERE h.categories like ? ORDER BY h.postId DESC';

        connection.query(sql, [`${categoryQuery}%`], (error, results) => {
            if (error) {
                console.error("Error searching posts:", error);
                return res.status(500).send('Error searching posts');
            }
            res.render('searched', {
                histogram_table: results,
                activePage: 'home',
                user: req.session.user,
                errorMessage: req.flash('error'),
                searchType: searchType,
                categoryQuery: categoryQuery
            });
        });


    } else if (searchType === 'user') {
        const userQuery = req.query.userQuery;
        const sql = 'SELECT h.*, u.name AS posted_by, u.role AS posted_role FROM histogram_table h INNER JOIN user_credentials u ON h.user_id = u.user_id WHERE u.name like ? ORDER BY h.postId DESC';

        connection.query(sql, [`${userQuery}%`], (error, results) => {
            if (error) {
                console.error("Error searching posts:", error);
                return res.status(500).send('Error searching posts');
            }
            res.render('searched', {
                histogram_table: results,
                activePage: 'home',
                user: req.session.user,
                errorMessage: req.flash('error'),
                searchType: searchType,
                userQuery: userQuery
            });
        });
    } else {
        // In case no conditions met
        res.status(400).send('Invalid search type specified');
    }
});

//Admin post approval enhancement - Done by Aden 
app.post('/approvePost/:id', checkAdmin, (req, res) => {
    const postid = req.params.id
    const sql = 'UPDATE histogram_table SET is_approved = ? WHERE postId = ?'

    connection.query(sql, [1, postid], (error, results) => {
        if (error) {
            console.log('Error approving the post', error)
        }
        else {
            approvedMessage: req.flash('approved', 'Post has been approved')
            res.redirect('/admin/dashboard')

        }
    })
});


app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
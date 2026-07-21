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

const PORT = 3000;

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

            // Redirect based on role
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


                // Duplicate email
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
<<<<<<< HEAD
                approvedMessage: req.flash('approved', 'Post has been approved')
=======
                approvedMessage: req.flash('approved','Post has been approved')
>>>>>>> e071d72336c94ddce097ced6fb469eaf5e9b1239
            })
        }

    })
})


// Evan - Part 4: Editing existing information

// Open the edit form
app.get('/editPost/:id', checkAuthenticated, (req, res) => {
    const postId = req.params.id;

    const sql = `
        SELECT *
        FROM histogram_table
        WHERE postId = ?
    `;

    connection.query(sql, [postId], (error, results) => {
        if (error) {
            console.log('Error retrieving post:', error);
            return res.redirect('/home');
        }

        if (results.length === 0) {
            req.flash('error', 'Post not found.');
            return res.redirect('/home');
        }

        const post = results[0];

        const isAdmin =
            req.session.user.role === 'admin';

        const isOwner =
            Number(req.session.user.user_id) ===
            Number(post.user_id);

        // Normal users can edit only their own posts
        if (!isAdmin && !isOwner) {
            req.flash(
                'error',
                'You do not have permission to edit this post.'
            );

            return res.redirect('/home');
        }

        res.render('edit', {
            post: post,
            activePage: 'editPost',
            user: req.session.user,
            errorMessage: req.flash('error')
        });
    });
});


// Save the edited information
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

        // Server-side validation
        if (
            !title ||
            !categories ||
            !caption ||
            !caption.trim()
        ) {
            req.flash(
                'error',
                'Title, category and caption are required.'
            );

            return res.redirect(`/editPost/${postId}`);
        }

        if (caption.length > 300) {
            req.flash(
                'error',
                'Caption cannot exceed 300 characters.'
            );

            return res.redirect(`/editPost/${postId}`);
        }

        // Retrieve the original post first
        const selectSql = `
            SELECT *
            FROM histogram_table
            WHERE postId = ?
        `;

        connection.query(
            selectSql,
            [postId],
            (selectError, results) => {
                if (selectError) {
                    console.log(
                        'Error checking post:',
                        selectError
                    );

                    return res.redirect('/home');
                }

                if (results.length === 0) {
                    req.flash('error', 'Post not found.');
                    return res.redirect('/home');
                }

                const post = results[0];

                const isAdmin =
                    req.session.user.role === 'admin';

                const isOwner =
                    Number(req.session.user.user_id) ===
                    Number(post.user_id);

                if (!isAdmin && !isOwner) {
                    req.flash(
                        'error',
                        'You do not have permission to edit this post.'
                    );

                    return res.redirect('/home');
                }

                // Keep the old image if no new image is selected
                const image = req.file
                    ? req.file.filename
                    : post.image;

                const updateSql = `
                    UPDATE histogram_table
                    SET title = ?,
                        categories = ?,
                        image = ?,
                        caption = ?
                    WHERE postId = ?
                `;

                const values = [
                    title.trim(),
                    categories,
                    image,
                    caption.trim(),
                    postId
                ];

                connection.query(
                    updateSql,
                    values,
                    (updateError) => {
                        if (updateError) {
                            console.log(
                                'Error updating post:',
                                updateError
                            );

                            req.flash(
                                'error',
                                'Unable to update the post.'
                            );

                            return res.redirect(
                                `/editPost/${postId}`
                            );
                        }

                        if (isAdmin) {
                            return res.redirect('/admin/home');
                        }

                        res.redirect('/home');
                    }
                );
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
                        return res.redirect('/home')
                    } else { return res.redirect('/home') } // Redirect user back to home page when the delete operation is successfull
                });
            } else { //If the user is not the owner of the post and not the admin 
                req.flash('error', 'You dont have the permission to delete other people post.');
                return res.redirect('/home')
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
<<<<<<< HEAD
                approvedMessage: req.flash('approved', 'Post has been approved')
=======
                approvedMessage: req.flash('approved','Post has been approved')
>>>>>>> e071d72336c94ddce097ced6fb469eaf5e9b1239
            });
        }
    });
});

// Admin Analytics Dashboard - Done by Ka Fai (Enhancement)
app.get('/admin/dashboard', checkAuthenticated, checkAdmin, (req, res) => {
<<<<<<< HEAD
  const sqlPosts = 'SELECT COUNT(*) AS totalPosts FROM histogram_table';
  const sqlUsers = 'SELECT COUNT(*) AS totalUsers FROM user_credentials';
  const sqlCategories = 'SELECT categories, COUNT(*) AS count FROM histogram_table GROUP BY categories';
  const sqlUsersList = 'SELECT u.name, u.role, COUNT(h.postId) AS post_count FROM user_credentials u LEFT JOIN histogram_table h ON u.user_id = h.user_id GROUP BY u.user_id, u.name, u.role ORDER BY u.role DESC, u.name ASC';
  const sqlPosts_admin_approval = 'SELECT h.*, u.name AS posted_by, u.role AS posted_role FROM histogram_table h INNER JOIN user_credentials u ON h.user_id = u.user_id ORDER BY h.postId DESC';
=======
    const sqlUsers = 'SELECT COUNT(*) AS totalUsers FROM user_credentials';
    const sqlCategories = 'SELECT categories, COUNT(*) AS count FROM histogram_table GROUP BY categories';
>>>>>>> e071d72336c94ddce097ced6fb469eaf5e9b1239

  connection.query(sqlPosts, (err1, postsCount) => {
    if (err1) return res.send('Error fetching posts count');

    connection.query(sqlUsers, (err2, usersCount) => {
      if (err2) return res.send('Error fetching users count');

      connection.query(sqlCategories, (err3, categoriesResult) => {
        if (err3) return res.send('Error fetching categories data');

        connection.query(sqlUsersList, (err4, usersList) => {
          if (err4) return res.send('Error fetching user list');

<<<<<<< HEAD
          connection.query(sqlPosts_admin_approval, (err5, approvalPosts) => {
            if (err5) return res.send('Error fetching approval posts');

            res.render('home', {
              activePage: 'adminDashboard',
              totalPosts: postsCount[0].totalPosts,
              totalUsers: usersCount[0].totalUsers,
              categoriesData: categoriesResult,
              userList: usersList,
              user: req.session.user,
              histogram_table: approvalPosts,
              errorMessage: req.flash('error'),
              approvedMessage: req.flash('approved', 'Post has been approved')
=======
                res.render('home', {
                    activePage: 'adminDashboard',
                    totalPosts: postsResult[0].totalPosts,
                    totalUsers: usersResult[0].totalUsers,
                    categoriesData: categoriesResult,
                    user: req.session.user,
                    errorMessage: req.flash('error')
                });
>>>>>>> e071d72336c94ddce097ced6fb469eaf5e9b1239
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
<<<<<<< HEAD
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

=======
app.post('/approvePost/:id', checkAdmin , (req,res)=>{
    const postid = req.params.id
    const sql = 'UPDATE histogram_table SET is_approved = ? WHERE postId = ?'

    connection.query(sql , [1,postid] , (error,results)=>{
        if(error){
            console.log('Error approving the post' , error)
        }
        else{
            approvedMessage: req.flash('approved','Post has been approved')
            res.redirect('/admin/dashboard')
            
        }
    })
});
>>>>>>> e071d72336c94ddce097ced6fb469eaf5e9b1239

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

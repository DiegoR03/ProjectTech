// SECURITY ////////////////////////////////////////////////////////////////////////////////////////

// XSS (detects and blocks scripts in forms)
var xss = require("xss");
var html = xss('<script>alert("xss");</script>');


//Validator restricts and unifies user input
const validator = require('validator');

//Hides sensitive info from the browser
const helmet = require("helmet");


// APP SET UP ///////////////////////////////////////////////////////////////////////////

require("dotenv").config();

const express = require("express");

const bcrypt = require("bcryptjs")
const app = express();
const session = require("express-session");
const port = 3000;
const multer = require("multer");

const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const { MongoClient, ObjectId } = require("mongodb");
const uri = process.env.URI;
const client = new MongoClient(uri);
const db = client.db(process.env.DB_NAME);
const userCollection = db.collection(process.env.USER_COLLECTION)
const petCollection = db.collection(process.env.PETS_COLLECTION)
const users = db.collection('users');

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./uploads"); // Make sure this is a relative path
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix);
    }
});

// Initialize Multer
const uploads = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed!"), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 }
});

let loggedIn = false;

// Connect to MongoDB
async function connectDB() {
    try {
        await client.connect();
        console.log("Client is connected to database");

    } catch (error) {
        console.log(error);
    }
}
connectDB();

app
    .use("/static", express.static("static"))
    .use(express.urlencoded({ extended: true }))
    .use(express.json())
    .use(
        session({
            resave: false,

            saveUninitialized: true,

            secret: process.env.SESSION_SECRET,

            cookie: {
                maxAge: 1000 * 60 * 60 * 24 // 1 day
            }
        }),
    )

    .use(async (req, res, next) => {
        try {
            if (req.session.userID) {
                const user = await userCollection.findOne({ _id: new ObjectId(req.session.userID) });

                if (user) {
                    res.locals.currentUser = {
                        _id: user._id,
                        firstName: user.firstName,
                        profileImage: user.profileImage,
                        notifications: user.notifications || []
                    };
                } else {
                    res.locals.currentUser = null;
                }
            } else {
                res.locals.currentUser = null;
            }
        } catch (err) {
            console.error('Error loading user info for views:', err);
            res.locals.currentUser = null;
        }

        next();
    })

    .use(helmet({
        contentSecurityPolicy: false,
        xDownloadOptions: false,
        xXssProtection: false,
    }))

    .use((req, res, next) => {
        res.locals.loggedIn = req.session.userID ? true : false;
        next();
    })

    .disable('x-powered-by')

    .set("view engine", "ejs")
    .set("views", "view")

    .get("/", loadHome)
    .get("/login", loadLogin)
    .get("/passwordchange", loadPasswordChange)
    .get("/browse", loadBrowse)
    .get('/browse', async (req, res) => {
        const filters = req.query;

        // Build MongoDB filter for customPets
        const mongoFilters = {};
        if (filters.species) mongoFilters.species = filters.species;
        if (filters.gender) mongoFilters.gender = filters.gender;
        if (filters.size) mongoFilters.size = filters.size;
        if (filters.age) mongoFilters.age = filters.age;
        if (filters.coat) mongoFilters.coat = filters.coat;
        if (filters.good_with_children) mongoFilters.good_with_children = filters.good_with_children;
        if (filters.good_with_dogs) mongoFilters.good_with_dogs = filters.good_with_dogs;
        if (filters.house_trained) mongoFilters.house_trained = filters.house_trained === 'true';

        const localPets = await db.collection('customPets').find(mongoFilters).toArray();

        const allPets = [...localPets /*, ...apiPets */];

        res.render('browse', {
            pets: allPets,
            pagination: { total_count: allPets.length, current_page: 1, total_pages: 1 },
            activeFilters: Object.entries(filters).map(([key, value]) => ({ label: key, value })),
            request: req
        });
    })

    .get("/index", loadHome)

    .get("/account", loadAccount)
    .get("/logout", (req, res) => {
        req.session.destroy();
        res.redirect("/login");
    })

    .get('/account', async (req, res) => {
        const userId = req.session.userID;
        let recentlyViewed = [];
        let favorites = [];
        let myPets = [];
        let user = null;

        if (userId) {
            const user = await userCollection.findOne({ _id: userId });
            myPets = await petCollection.find({ addedByUserId: userId }).toArray();

            const now = Date.now();
            // Filter out expired pets (older than 120 hours or with no tiem)
            recentlyViewed = (user?.recentlyViewed || []).filter(p => now - p.timestamp < 120 * 60 * 60 * 1000);

            // Update MongoDB 
            await userCollection.updateOne(
                { _id: userId },
                { $set: { recentlyViewed, favorites } }
            );

            req.session.recentlyViewed = recentlyViewed;
            req.session.favorites = favorites;
        }

        res.render('account', {
            recentlyViewed,
            firstName: user?.firstName || '',
            lastName: user?.lastName || '',
            userStory: user?.userStory || '',
            profileImage: user?.profileImage || '',
            loggedIn: !!req.session.userID,
            favorites: user?.favorites || [],
            myPets,
            createdAt: user?.createdAt || null
        });
    })

    .get('/detail/:id', async (req, res) => {
        const petId = req.params.id;

        try {
            const now = Date.now();

            // 1. Try to find pet in your own MongoDB collection
            const mongoPet = await petCollection.findOne({ id: petId }); // if stored as string

            let pet;

            if (mongoPet) {
                // Pet was found in your MongoDB collection
                pet = mongoPet;
            } else {
                // 2. Not found locally, fetch from Petfinder API
                const token = await getPetfinderToken();
                const response = await fetch(`https://api.petfinder.com/v2/animals/${petId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                const data = await response.json();
                pet = data.animal;

                if (!pet) throw new Error("Pet not found");
            }

            // 3. Handle recently viewed
            if (!req.session.recentlyViewed) req.session.recentlyViewed = [];

            // Filter out expired and duplicates
            req.session.recentlyViewed = req.session.recentlyViewed
                .filter(p => now - p.timestamp < 120 * 60 * 60 * 1000)
                .filter(p => p.id !== pet.id);

            // Add current pet to recently viewed
            const petData = {
                id: pet.id,
                name: pet.name || pet.petname, // for local pets
                photo: pet.photos?.[0]?.medium || pet.photo?.[0]?.medium || null,
                gender: pet.gender,
                breed: pet.breed || pet.breeds?.primary,
                timestamp: now
            };

            req.session.recentlyViewed.unshift(petData);
            req.session.recentlyViewed = req.session.recentlyViewed.slice(0, 5);

            // Save to user document if logged in
            if (req.session.email) {
                await users.updateOne(
                    { email: req.session.email },
                    { $set: { recentlyViewed: req.session.recentlyViewed } }
                );
            }

            res.render('detail', { pet });
        } catch (err) {
            console.error("Error in /detail route:", err);
            res.status(500).send('Error fetching pet details.');
        }
    })

    .get("/detail/:id", loadDetail)
    .get('/fave/:id', async (req, res) => {
        const petId = req.params.id;

        try {
            // First, try to find pet in customPets (local)
            const customPet = await db.collection('customPets').findOne({ id: petId });

            if (customPet) {
                // It's a custom pet
                const petData = {
                    id: customPet.id,
                    name: customPet.name,
                    photo: customPet.photos?.[0]?.medium || null,
                    gender: customPet.gender,
                    breed: customPet.breeds?.primary || '',
                    isCustom: true
                };

                if (!req.session.favorites) req.session.favorites = [];

                // Check if already favorited
                const alreadyFavorited = req.session.favorites.some(p => p.id === petId);
                if (!alreadyFavorited) {
                    req.session.favorites.unshift(petData);

                    if (req.session.userID) {
                        await userCollection.updateOne(
                            { _id: new ObjectId(req.session.userID) },
                            { $set: { favorites: req.session.favorites } }
                        );
                    }

                    // Notify owner if liker is not the owner
                    if (customPet.addedByUserId && req.session.userID !== customPet.addedByUserId.toString()) {
                        const ownerId = new ObjectId(customPet.addedByUserId);
                        const liker = await userCollection.findOne({ _id: new ObjectId(req.session.userID) });
                        const message = `${liker.firstName} liked your pet "${customPet.name}"`;
                        const image = liker.profileImage;

                        await userCollection.updateOne(
                            { _id: ownerId },
                            { $push: { notifications: { image, message, petId, timestamp: Date.now() } } }
                        );
                    }
                }

                // Render detail with the local pet
                return res.render('detail', { pet: customPet });
            }

            // Pet from Petfinder API
            const token = await getPetfinderToken();
            const response = await fetch(`https://api.petfinder.com/v2/animals/${petId}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const data = await response.json();
            const pet = data.animal;
            if (!pet) throw new Error("Pet not found");

            const petData = {
                id: pet.id,
                name: pet.name,
                photo: pet.photos?.[0]?.medium || null,
                gender: pet.gender,
                breed: pet.breeds.primary,
                isCustom: false
            };

            if (!req.session.favorites) req.session.favorites = [];

            const alreadyFavorited = req.session.favorites.some(p => p.id === petId);
            if (!alreadyFavorited) {
                req.session.favorites.unshift(petData);

                if (req.session.userID) {
                    await userCollection.updateOne(
                        { _id: new ObjectId(req.session.userID) },
                        { $set: { favorites: req.session.favorites } }
                    );
                }
            }

            res.render('detail', { pet });
        } catch (err) {
            console.error("Error in /fave/:id route:", err);
            res.status(500).send('Error fetching pet details.');
        }
    })

    .get('/removefavorite/:id', async (req, res) => {
        const petId = req.params.id;

        try {
            if (!req.session.favorites) req.session.favorites = [];

            req.session.favorites = req.session.favorites.filter(p => String(p.id) !== String(petId));

            if (req.session.userID) {
                await userCollection.updateOne(
                    { _id: new ObjectId(req.session.userID) },
                    { $set: { favorites: req.session.favorites } }
                );
            }

            const customPet = await db.collection('customPets').findOne({ id: petId });

            if (customPet) {
                return res.redirect('/account');
            }

            const token = await getPetfinderToken();
            const response = await fetch(`https://api.petfinder.com/v2/animals/${petId}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const data = await response.json();
            const pet = data.animal;
            if (!pet) throw new Error("Pet not found");

            res.redirect('/account');

        } catch (err) {
            console.error("Error removing notifucation", err);
            res.status(500).send('Error removing pet from favorites.');
        }
    })


    .get("/fave/:id", loadFave)

    .get("/searchForm", loadSearchForm)
    .get("/results-search-form", loadResultsSearchForm)

    // GET form
    .get('/post-pet', (req, res) => {
        if (!req.session.user) return res.redirect('/login');
        res.render('addPetForm'); // Create this EJS view
    })

    // POST form submission
    .post('/post-pet', uploads.single('photo'), async (req, res) => {

        async function generateCustomId() {
            let id;
            let exists = true;
            while (exists) {
                id = String(Math.floor(Math.random() * 10000000)).padStart(7, '0');
                exists = await db.collection('customPets').findOne({ id });
            }
            return id;
        }

        const {
            petname, description, type, breed, size, gender, age, coat, children, dogs, cats, house_trained, shots_current, isCastrated, isComfystrangers, isAloneOften, isPlayful, isPaired, activity } = req.body;

        let processedPhotoPath = null;

        function toBoolean(value) {
            return value === 'true' ? true : value === 'false' ? false : undefined;
        }

        try {
            if (req.file) {
                const outputPath = `uploads/post-a-pet/${req.file.filename}.jpg`;
                await sharp(req.file.path)
                    .resize(300, 300)
                    .toFile(outputPath);

                processedPhotoPath = `/${outputPath}`;
            }

            const id = await generateCustomId();

            const newPet = {
                id,
                name: petname,
                description,
                species: type,
                size,
                gender,
                age,
                coat,
                activity: toBoolean(activity),
                breeds: { primary: breed },
                environment: {
                    children: toBoolean(children),
                    dogs: toBoolean(dogs),
                    cats: toBoolean(cats)
                },
                attributes: {
                    house_trained: toBoolean(house_trained),
                    shots_current: toBoolean(shots_current)
                },
                profile: {
                    isCastrated,
                    isComfystrangers,
                    isAloneOften,
                    isPlayful,
                    isPaired
                },
                photos: processedPhotoPath ? [{ medium: processedPhotoPath }] : [],
                addedByUserId: req.session.userID || null
            };

            await db.collection('customPets').insertOne(newPet);
            res.redirect('/account');
        } catch (err) {
            console.error('Error uploading or processing image:', err);
            res.status(500).send('An error occurred while posting the pet.');
        }
    })

    .post('/notifications/clear', async (req, res) => {
        if (!req.session.userID) return res.status(401).send('Unauthorized');

        try {
            await userCollection.updateOne(
                { _id: new ObjectId(req.session.userID) },
                { $set: { notifications: [] } }
            );
            res.redirect('/account');
        } catch (err) {
            console.error('Error clearing notifications:', err);
            res.status(500).send('Server error');
        }
    })


    .post("/login", processLogin)
    .post('/account', uploads.single('profileImage'), changeStory)
    .post("/passwordchange", changePassword)
    .post("/searchForm", processForm)
    .post("/register", uploads.single("fileInput"), processRegistration)

    .listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });

// RENDERING VIEWS ///////////////////////////////////////////////////////////

function loadHome(req, res) {
    req.session.userID = 95234;
    let userID = req.session.userID;
    res.render("index.ejs", { userID });
}

function loadLogin(req, res) {
    req.session.userID = 95234;
    let userID = req.session.userID;
    res.render("login.ejs", { userID });
}


function loadPasswordChange(req, res) {
    req.session.userID = 95234;
    let userID = req.session.userID;
    res.render("passwordchange.ejs", { userID });
}

async function loadDetail(req, res) {
    const petId = req.params.id;
    const userID = req.session.userID || 95234;
    console.log("Fetching pet ID:", petId);

    try {
        // Step 1: Try to find pet in your own MongoDB collection
        const mongoPet = await petCollection.findOne({ id: Number(petId) }); // or { id: petId } if stored as a string

        let pet = null;

        if (mongoPet) {
            console.log("Found pet in MongoDB");
            pet = mongoPet;
        } else {
            // Step 2: Fall back to Petfinder API
            const token = await getPetfinderToken();
            const url = `https://api.petfinder.com/v2/animals/${petId}`;
            console.log("API Request:", url);

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const data = await response.json();
            console.log("Petfinder Response:", data);

            pet = data.animal;

            if (!pet) throw new Error("Pet not found from Petfinder");
        }

        // Step 3: Render page
        res.render("detail.ejs", {
            pet,
            userID
        });

    } catch (error) {
        console.error("Error fetching pet detail:", error);
        res.status(500).render("detail.ejs", {
            pet: null,
            error: "Could not load pet details.",
            userID
        });
    }
}


//Fave page ///////////////////////////////////////////////////////////////
async function loadFave(req, res) {
    try {
        const userID = req.session.userID;
        const user = await userCollection.findOne({ _id: new ObjectId(userID) });
        const pets = user?.favorites || [];

        res.render("fave.ejs", {
            pets,
            pagination: null,
            error: null,
            request: req,
            activeFilters: []
        });

    } catch (error) {
        console.error("Error loading favorites:", error);
        res.status(500).render("fave.ejs", {
            pets: [],
            pagination: null,
            error: "Couldn't catch favourites.",
            request: req,
            activeFilters: []
        });
    }
}


function loadSearchForm(req, res) {
    if (!req.session.userID) {
        req.session.userID = 95234;
    }
    let userID = req.session.userID;


    // Retrieves questionlist from 'search-form.js'
    const { questions, questionLabels } = require('./static/js/search-form');

    const questionNum = parseInt(req.query.stepIndex) || 0;
    const step = questions[questionNum];

    if (!req.session.answers) {
        req.session.answers = {};
    } else if (questionNum === 0) {
        req.session.answers = {};

    }
    let userAnswers = req.session.answers;

    const isLastStep = (questionNum === questions.length - 1);

    res.render("searchForm.ejs", {
        userID,
        stepTitle: `Stap ${questionNum + 1}`,
        question: step.question,
        options: step.options,
        stepIndex: questionNum,
        totalSteps: questions.length,
        isLastStep,
        fieldName: step.name
    });

}


function ensureAuthenticated(req, res, next) {
    if (req.session.userID) {
        next();
    } else {
        res.redirect("/login");
    }
}

app.get("/account", ensureAuthenticated, loadAccount);


function loadResultsSearchForm(req, res) {
    req.session.userID = 95234;

    let userID = req.session.userID;
    const userAnswers = req.session.answers || {};
    const { question, questionLabels } = require('./static/js/search-form');

    const groupedAnswers = {
        "General Info": ['type', 'size', 'gender', 'age'],
        "Living Situation": ['hasKids', 'hasCats', 'hasDogs', 'floor', 'hasGarden'],
        "Pet Personality": ['isComfystrangers', 'isPlayful']
    };


    res.render("results-search-form.ejs", { userID, userAnswers, groupedAnswers, questionLabels });
}

function loadRegistry(req, res) {
    req.session.userID = 95234;
    let userID = req.session.userID;
    res.render("register.ejs", { userID });
}


// PROCESS FUNCTIONS ////////////////////////////////////////////////////////////////////////////////////////

// LOGIN ////////////////////////////////////////////////////////////////////////////////////////
async function processLogin(req, res) {
    const email = req.body.email;
    const password = req.body.password;

    try {
        const user = await userCollection.findOne({ email });

        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userID = user._id;
            req.session.email = user.email;
            req.session.firstName = user.firstName;
            req.session.profileImage = user.profileImage || '/static/default.png';
            req.session.userStory = user.story || '';
            req.session.recentlyViewed = user.recentlyViewed || [];
            req.session.favorites = user.favorites || [],
                req.session.createdAt = user.createdAt

            res.redirect("/account");
        } else {
            res.render("login.ejs", { data: "Invalid credentials" });
        }
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).render("login", { data: "An error occurred during login." });

        app.post("/register", uploads.single('profileImage'), processRegistration);
    }
}


function processForm(req, res) {
    const { option, stepIndex, } = req.body;
    const step = parseInt(stepIndex);

    if (!req.session.answers) {
        req.session.answers = {};
    }

    // Load questions
    const { questions, questionLabels } = require('./static/js/search-form');
    const currentQuestion = questions[step];

    if (currentQuestion && currentQuestion.name) {
        // Save the answer using the field name as key
        req.session.answers[currentQuestion.name] = option;
    }

    const nextStep = step + 1;
    if (nextStep >= questions.length) {
        // All steps completed, redirect to browse (or results page)
        return res.redirect("/results-search-form");
    }


    res.redirect(`/searchForm?stepIndex=${nextStep}`);
};

app.post('/results-search-form', (req, res) => {
    const newAnswers = req.body;

    if (!req.session.answers) {
        req.session.answers = {};
    }


    for (let key in newAnswers) {
        const cleanKey = xss(key);
        const cleanValue = xss(newAnswers[key]);
        req.session.answers[cleanKey] = cleanValue;
    }
    res.status(200).send('Answers updated');
});

async function processRegistration(req, res) {
    const firstname = req.body.firstName;
    const lastname = req.body.lastName;
    const email = req.body.email;
    const password = req.body.password;
    const hashedPassword = await bcrypt.hash(password, 8);

    try {
        const existingUser = await userCollection.findOne({ email });
        if (existingUser) {
            console.log("This email is already in use.");
            res.render("register", { data: "Email is already registered" });
            return;
        }
        else {
            // Save image file path if uploaded
            let profileImagePath = null;
            if (req.file) {
                const inputPath = req.file.path;

                const outputPath = path.join("uploads/", "square-" + req.file.filename);

                await sharp(inputPath)
                    .resize(800, 800, {
                        fit: sharp.fit.cover,
                        position: sharp.strategy.entropy
                    })
                    .toFile(outputPath);

                profileImagePath = "/" + outputPath.replace(/\\/g, "/"); // Normalize path for all OS

                // Optionally: delete the original uploaded file if not needed
                fs.unlinkSync(inputPath);
            } else {
                // Randomly choose a default profile image
                const defaultImages = [
                    "/uploads/standard/default1.png",
                    "/uploads/standard/default2.png",
                    "/uploads/standard/default3.png"
                ];
                profileImagePath = defaultImages[Math.floor(Math.random() * defaultImages.length)];
            }

            // Register user with image (if uploaded)
            const newUser = {
                firstName: firstname,
                lastName: lastname,
                email: email.trim(),
                password: hashedPassword,
                profileImage: profileImagePath,
                createdAt: new Date(),
                userStory: "A short story about you",
            };

            await userCollection.insertOne(newUser);
            console.log("Registration successful:", newUser);
            res.redirect("/login");
            return;
        }

    } catch (error) {
        console.error("Error during registration:", error);
        res.status(500).render("login", { data: "An error occurred during registration." });
    }
}


// CHANGE PASSWORD ////////////////////////////////////////////////////////////////////////////////////////

async function changePassword(req, res) {
    const email = req.body.email;
    const newpassword = req.body.password_new;
    const confirmpassword = req.body.password_confirm;

    const hashedNewPassword = await bcrypt.hash(newpassword, 8)

    try {
        const existingemail = await userCollection.findOne({ email });

        if (existingemail && newpassword == confirmpassword) {
            console.log("Password is changed");
            userCollection.updateOne({ email: email }, { $set: { password: hashedNewPassword } })
            console.log(existingemail);
            res.redirect("/login");
            return;
        } else {
            console.log("Change failed");
            res.render("passwordchange.ejs");
        }

    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).render("login", { data: "An error occurred during change." });
    }
}


// ONLY USE UPLOADED IMAGES TO "/uploads"
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// PROFILE ///////////////////////////////////////////////////////
async function loadAccount(req, res) {
    if (!req.session.userID) {
        res.redirect("/login");
        return;
    }


    try {
        const user = await userCollection.findOne({ _id: new ObjectId(req.session.userID) });
        if (!user) {
            return res.status(404).render("account.ejs", { error: "User not found." });
        } else {
            // Get recently viewed pets from session
            const recentlyViewed = req.session.recentlyViewed || [];
            const myPets = await petCollection.find({ addedByUserId: user._id.toString() }).toArray();

            res.render("account.ejs", {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                profileImage: user.profileImage,
                userStory: user.userStory,
                recentlyViewed: req.session.recentlyViewed || [],
                favorites: user.favorites || [],
                myPets,
                createdAt: user.createdAt
            });
        }
    } catch (error) {
        console.error("Error loading account:", error);
        res.status(500).render("account.ejs", { error: "An error occurred while loading your account." });
    }
}

app.get('/test-session', (req, res) => {
    if (!req.session.counter) req.session.counter = 0;
    req.session.counter++;
    res.send(`Session counter: ${req.session.counter}`);
});


async function changeStory(req, res) {
    try {
        const user = await userCollection.findOne({ _id: new ObjectId(req.session.userID) });
        if (!user) return res.status(404).send("User not found");

        const email = user.email;
        const fieldsToUpdate = ['firstName', 'lastName', 'userStory'];
        const updates = {};

        // Update text fields if changed
        for (const field of fieldsToUpdate) {
            const newValue = req.body[field];
            if (newValue !== undefined && newValue.trim() !== "" && newValue !== user[field]) {
                updates[field] = newValue;
            }
        }

        // Handle profile image upload if present
        if (req.file) {
            const inputPath = req.file.path;

            const outputPath = path.join("uploads/", "square-" + req.file.filename);

            await sharp(inputPath)
                .resize(800, 800, {
                    fit: sharp.fit.cover,
                    position: sharp.strategy.entropy
                })
                .toFile(outputPath);

            updates.profileImage = "/" + outputPath.replace(/\\/g, "/"); // Normalize path for all OS
        }

        if (Object.keys(updates).length > 0) {
            await userCollection.updateOne({ email: email }, { $set: updates });
            console.log("Updated fields:", updates);
        } else {
            console.log("No changes detected.");
        }

        res.redirect("/account");

    } catch (error) {
        console.error("Error during update:", error);
        res.status(500).redirect("/login");
    }
}




// GETTING API TOKEN /////////////////////////////////////////////////////////////////////

async function getPetfinderToken() {
    const response = await fetch("https://api.petfinder.com/v2/oauth2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            grant_type: "client_credentials",
            client_id: process.env.PET_FINDER_API_KEY,
            client_secret: process.env.API_SECRET
        })
    });

    const data = await response.json();
    return data.access_token;
}


// REQUEST API QUERY & FILTERING ////////////////////////////////////////////////////////
async function loadBrowse(req, res) {
    try {

        res.locals.isFetching = true; // Set flag before API call
        const token = await getPetfinderToken();
        const petsPerPage = 9;
        const page = parseInt(req.query.page) || 1;

        const allowedFilters = [
            "type", "gender", "size", "age", "coat",
            "good_with_children", "good_with_dogs",
            "good_with_cats", "house_trained"
        ];

        const filterMap = {
            species: "type",
            gender: "gender",
            size: "size",
            age: "age",
            coat: "coat",
            good_with_children: "good_with_children",
            good_with_dogs: "good_with_dogs",
            good_with_cats: "good_with_cats",
            house_trained: "house_trained"
        };

        // Step 1: Build query filters string
        const appliedFilters = {};
        const apiBatch = new URLSearchParams({ limit: "100" });

        for (let key in req.query) {
            const apiKey = filterMap[key] || key;
            if (allowedFilters.includes(apiKey) && req.query[key]) {
                apiBatch.append(apiKey, req.query[key]);
                appliedFilters[apiKey] = req.query[key];
            }
        }

        // Step 2: Create a unique key for current filter combo
        const filterKey = JSON.stringify(appliedFilters);
        req.session.petsCache = req.session.petsCache || {};

        let petsWithImages = [];

        // Step 3: Check session cache first
        if (req.session.petsCache[filterKey]) {
            petsWithImages = req.session.petsCache[filterKey];
        } else {
            // Step 4: Fetch data from API
            const totalApiBatches = 4;
            const pagePromises = [];

            for (let i = 1; i <= totalApiBatches; i++) {
                const pageParams = new URLSearchParams(apiBatch.toString());
                pageParams.set("page", i);

                const url = `https://api.petfinder.com/v2/animals?${pageParams.toString()}`;

                pagePromises.push(
                    fetch(url, {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }).then(res => {
                        if (!res.ok) throw new Error(`API error: ${res.status}`);
                        return res.json();
                    })
                );
            }

            const allApiResults = await Promise.all(pagePromises);

            for (const page of allApiResults) {
                if (page.animals) {
                    const petsWithPhotos = page.animals.filter(pet => pet.photos && pet.photos.length > 0);
                    petsWithImages.push(...petsWithPhotos);
                }
            }



            req.session.petsCache[filterKey] = petsWithImages;
        }

        // Step 5: In-memory pagination
        const totalPets = petsWithImages.length;
        const totalPages = Math.ceil(totalPets / petsPerPage);
        const startIndex = (page - 1) * petsPerPage;
        const endIndex = startIndex + petsPerPage;
        const displayedPets = petsWithImages.slice(startIndex, endIndex);

        // Step 6: Build activeFilters for UI
        const filterLabels = {
            species: "Species",
            gender: "Gender",
            size: "Size",
            age: "Age",
            coat: "Coat",
            good_with_children: "Good with children",
            good_with_dogs: "Good with dogs",
            good_with_cats: "Good with cats",
            house_trained: "House trained"
        };

        const activeFilters = [];
        for (const key in req.query) {
            if (req.query[key] && filterLabels[key]) {
                activeFilters.push({
                    key,
                    label: filterLabels[key],
                    value: req.query[key]
                });
            }
        }

        res.render("browse.ejs", {
            pets: displayedPets,
            pagination: {
                current_page: page,
                total_pages: totalPages,
                total_count: totalPets
            },
            error: null,
            request: req,
            activeFilters,
            isFetching: false
        });

    } catch (error) {
        console.error("Browse error:", error);
        res.status(500).render("browse.ejs", {
            pets: [],
            pagination: null,
            error: "Could not fetch pet data.",
            request: req,
            activeFilters: [],
            isFetching: false

        });
    }
}
// FIND MY MATCH //////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/match', async (req, res) => {
    const userAnswers = req.session.answers;
    if (!userAnswers || Object.keys(userAnswers).length === 0) {
        return res.status(400).json({ error: "No answers found in session." });
    }

    try {
        const token = await getPetfinderToken();
        const url = `https://api.petfinder.com/v2/animals?limit=100&type=${userAnswers.type || 'dog'}`;

        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });


        const data = await response.json();
        const animals = data.animals || [];
        // Normalize 'Yes'/'No' to 'true'/'false'
        for (let key in userAnswers) {
            if (userAnswers[key] === 'Yes') userAnswers[key] = 'true';
            if (userAnswers[key] === 'No') userAnswers[key] = 'false';
        }

        const scored = animals.map(pet => {
            let score = 0;
            let reason = [];
            const hasGarden = userAnswers.hasGarden === 'true';

            const floor = userAnswers.floor; // groundfloor / upperfloor-with-elevator / upperfloor-without-elevator

            // --- 1. ENVIRONMENT DEALBREAKERS ---
            if (userAnswers.hasKids === 'true') {
                if (pet.environment?.children === false) {
                    score -= 10;
                    reason.push("⚠️ Not suitable for kids");
                } else if (pet.environment?.children === true) {
                    score += 2;
                    reason.push("✅ Good with children");
                }
            }

            if (userAnswers.hasDogs === 'true') {
                if (pet.environment?.dogs === false) {
                    score -= 5;
                    reason.push("⚠️ Not dog-friendly");
                } else if (pet.environment?.dogs === true) {
                    score += 2;
                    reason.push("✅ Gets along with other dogs");
                }
            }

            if (userAnswers.hasCats === 'true') {
                if (pet.environment?.cats === false) {
                    score -= 5;
                    reason.push("⚠️ Not cat-friendly");
                } else if (pet.environment?.cats === true) {
                    score += 2;
                    reason.push("✅ Gets along with cats");
                }
            }

            // --- 2. POSITIVE ENVIRONMENT SYNERGIES ---
            if (pet.size === 'Large' && hasGarden) {
                score += 6;
                reason.push("✅ Perfect fit: large active dog + garden");
            }

            if (pet.size === 'Large' && floor === 'groundfloor') {
                score += 3;
                reason.push("✅ Large pet and ground floor — easy access");
            }

            if (pet.size === 'Medium' && floor === 'upperfloor-without-elevator') {
                score += 3;
                reason.push("✅ Medium sized pet — easy in stairs");
            }

            if (pet.size === 'Small' && floor === 'upperfloor-without-elevator') {
                score -= 3;
                reason.push("⚠️ Small pet and no elevator — tough match");
            }


            if (hasGarden) {
                score += 2;
                reason.push("✅ Garden provides outdoor space");
            }

            if (!hasGarden && pet.size === 'Small') {
                score += 2;
                reason.push("✅ Small dog is fine without garden");
            }

            // --- 3. LIFESTYLE MATCH ---
            // if (isOftenAlone && pet.tags?.includes('Independent')) {
            //     score += 4;
            //     reason.push("✅ Independent pet for alone household");
            // }

            // if (!isOftenAlone && pet.description?.toLowerCase().includes('attention')) {
            //     score += 3;
            //     reason.push("✅ Pet needs attention and you're often home");
            // }

            // if (isOftenAlone && pet.description?.toLowerCase().includes('attention')) {
            //     score -= 3;
            //     reason.push("⚠️ Needs attention but owner away often");
            // }

            // --- 4. USER PREFERENCES ---
            if (pet.gender?.toLowerCase() === userAnswers.gender?.toLowerCase()) {
                score += 2;
                reason.push("✅ Preferred gender");
            }
            if (pet.age?.toLowerCase() === userAnswers.age?.toLowerCase()) {
                score += 1;
                reason.push("✅ Preferred age");
            }

            if (pet.size?.toLowerCase() === userAnswers.size?.toLowerCase()) {
                score += 2;
                reason.push("✅ Preferred size");
            }

            // if (pet.coat?.toLowerCase() === userAnswers.coat?.toLowerCase()) {
            //     score += 1;
            //     reason.push("✅ Preferred coat type");
            // }

            // if (userAnswers.isHousetrained === 'true' && pet.attributes?.house_trained) {
            //     score += 3;
            //     reason.push("✅ Already housetrained");
            // }

            // if (userAnswers.isCastrated === 'true' && pet.attributes?.spayed_neutered) {
            //     score += 1;
            //     reason.push("✅ Castrated/neutered");
            // }

            const description = pet.description?.toLowerCase() || "";
            const tags = pet.tags?.map(t => t.toLowerCase()) || [];

            // Match "playful" personality
            if (userAnswers.isPlayful === 'true') {
                if (
                    description.includes('play') ||
                    tags.includes('playful') ||
                    tags.includes('energetic') ||
                    tags.includes('active')
                ) {
                    score += 2;
                    reason.push("✅ Playful match");
                } else {
                    reason.push("ℹ️ Might not be very playful");
                }
            }

            // Match "friendly with strangers"
            if (userAnswers.isComfystrangers === 'true') {
                if (
                    description.includes('friendly') ||
                    tags.includes('friendly') ||
                    tags.includes('social') ||
                    tags.includes('affectionate') ||
                    tags.includes('outgoing')
                ) {
                    score += 2;
                    reason.push("✅ Friendly with strangers");
                } else {
                    reason.push("ℹ️ May be shy with strangers");
                }
            }

            // --- 6. CONFLICTS ---
            if (pet.type === 'Dog' && pet.size === 'Small' && floor === 'upperfloor-without-elevator') {
                score -= 3;
                reason.push("⚠️ Small pet and no elevator — tough match");
            }

            return { ...pet, matchScore: score, matchReasons: reason };
        });


        console.log("User selected age:", userAnswers.age);


        const bestMatches = scored
            .filter(p => p.photos && p.photos.length > 0)
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 10);

        res.json(bestMatches);

    } catch (error) {
        console.error("Matching failed:", error);
        res.status(500).json({ error: "Matching failed." });
    }
});

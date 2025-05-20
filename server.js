// SECURITY ////////////////////////////////////////////////////////////////////////////////////////

// XSS (detects and blocks scripts in forms)
var xss = require("xss");
var html = xss('<script>alert("xss");</script>');
console.log('look here' + html);

//Validator restricts and unifies user input
const validator = require('validator');

//Hides sensitive info from the browser
const helmet = require("helmet");


// APP SET UP ///////////////////////////////////////////////////////////////////////////

require("dotenv").config();

const express = require("express");
const app = express();
const session = require("express-session");
const port = 3000;

const { MongoClient, ObjectId } = require("mongodb");
const uri = process.env.URI;
const client = new MongoClient(uri);
const db = client.db(process.env.DB_NAME);
const userCollection = db.collection(process.env.USER_COLLECTION)

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
    .use(
        session({
            resave: false,

            saveUninitialized: true,

            secret: process.env.SESSION_SECRET,
        }),
    )
    .use(helmet({
        contentSecurityPolicy: false,
        xDownloadOptions: false,
        xXssProtection: false,
    }))

    .disable('x-powered-by')

    .set("view engine", "ejs")
    .set("views", "view")

    .get("/", loadHome)
    .get("/login", loadLogin)
    .get("/register", loadRegistry)
    .get("/passwordchange", loadPasswordChange)
    .get("/browse", loadBrowse)
    .get("/searchForm", loadSearchForm)
    .get("/results-search-form", loadResultsSearchForm)

    .post("/login", processLogin)
    .post("/register", processRegistration)
    .post("/passwordchange", changePassword)
    .post("/searchForm", processForm)

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

function loadRegistry(req, res) {
    req.session.userID = 95234;
    let userID = req.session.userID;
    res.render("register.ejs", { userID });
}

function loadPasswordChange(req, res) {
    req.session.userID = 95234;
    let userID = req.session.userID;
    res.render("passwordchange.ejs", { userID });
}

function loadSearchForm(req, res) {
    if (!req.session.userID) {
        req.session.userID = 95234;
    }
    let userID = req.session.userID;


    // Retrieves questionlist from 'search-form.js'
    const {questions, questionLabels} = require('./src/scripts/search-form');

    const questionNum = parseInt(req.query.stepIndex) || 0;
    const step = questions[questionNum];

    if (!req.session.answers) {
        req.session.answers = {};
    } else if (questionNum === 0) {
        req.session.answers = {};
    }
    let userAnswers = req.session.answers;

    console.log("User answers so far:", userAnswers);

    if (!step) {
        console.log(userAnswers);
        // return res.redirect("/results-search-form"); // All steps completed
    }

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

function loadResultsSearchForm(req, res) {
    req.session.userID = 95234;

    let userID = req.session.userID;
    const userAnswers = req.session.answers || {};
    const {question, questionLabels } = require('./src/scripts/search-form');

    const groupedAnswers = {
        "General Info": ['type', 'size', 'gender', 'isCastrated', 'coat'],
        "Living Situation": ['hasKids', 'hasCats', 'hasDogs', 'isAloneOften', 'floor', 'hasGarden'],
        "Pet Personality": ['activity', 'isHousetrained', 'isComfystrangers', 'isPlayful', 'isPaired']
    };


    res.render("results-search-form.ejs", { userID, userAnswers, groupedAnswers, questionLabels });
}






//  PROCESS FUNCTIONS //////////////////////////////////////////////////////////
async function processLogin(req, res) {
    const email = req.body.email;
    const password = req.body.password;

    try {
        const existingemail = await userCollection.findOne({ email });
        const existingpassword = await userCollection.findOne({ password });

        if (existingemail && existingpassword) {
            console.log("Log in successfull");
            loggedIn = true;
            res.render("browse.ejs");
        } else {
            console.log("Log in invalid");
            loggedIn = false;
            res.render("login.ejs");
        }

    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).render("login", { data: "An error occurred during login." });
    }
}

async function processRegistration(req, res) {
    const email = req.body.email;


    try {
        const existingUser = await userCollection.findOne({ email });
        if (existingUser) {
            console.log("This email is already in use.");
            res.render("login", { data: "Email is already registered" });
        } else {
            userCollection.insertOne(req.body);
            let message = "Registration successful"
            res.render("login", { data: message });
        }

    } catch (error) {
        console.error("Error during registration:", error);
        res.status(500).render("login", { data: "An error occurred during registration." });
    }

}
function processForm(req, res) {
    const { option, stepIndex, } = req.body;
    const step = parseInt(stepIndex);

    if (!req.session.answers) {
        req.session.answers = {};
    }

    // Load questions
    const {questions, questionLabels} = require('./src/scripts/search-form');
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


async function changePassword(req, res) {
    const email = req.body.email;
    const password = req.body.password;
    const newpassword = req.body.password_new;

    try {
        const existingemail = await userCollection.findOne({ email });
        const existingpassword = await userCollection.findOne({ password });

        if (existingemail && existingpassword) {
            console.log("Password is changed");
            userCollection.updateOne({ email: email }, { $set: { password: newpassword } })
            console.log(existingemail);
            res.render("login.ejs");
        } else {
            console.log("Change failed");
            res.render("passwordchange.ejs");
        }

    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).render("login", { data: "An error occurred during change." });
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
        const token = await getPetfinderToken();
        const petsPerPage = 8;
        const page = parseInt(req.query.page) || 1;
        const apiBatch = new URLSearchParams({
            limit: 100 // fetch in batches (max allowed by Petfinder)
        });

        // Apply query filters
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

        for (let key in req.query) {
            const apiKey = filterMap[key] || key;
            if (allowedFilters.includes(apiKey) && req.query[key]) {
                apiBatch.append(apiKey, req.query[key]);
            }
        }

        // Custom pagination logic
        const startPageIndex = (page - 1) * petsPerPage;
        const endPageIndex = page * petsPerPage;
        let petsWithImages = [];

        const totalApiBatches = 4;
        const pagePromises = [];


        for (let i = 1; i <= totalApiBatches; i++) {
            const pageParams = new URLSearchParams(apiBatch);
            pageParams.set("page", i);

            const url = `https://api.petfinder.com/v2/animals?${pageParams.toString()}`;
            pagePromises.push(fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => res.json()));
        }

        console.log("THE API IS BEING HIT!!!")

        const unfilteredPageResults = await Promise.all(pagePromises);

        // Filters out pets that don't have images
        for (const page of unfilteredPageResults) {
            if (page.animals) {
                const petsWithPhotos = page.animals.filter(pet => pet.photos && pet.photos.length > 0);
                petsWithImages.push(...petsWithPhotos);
            }
        }

        const pets = petsWithImages.slice(startPageIndex, endPageIndex);

        // Build activeFilters array for UI
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

        // Custom pagination UI values
        const totalPages = Math.ceil(petsWithImages.length / petsPerPage);

        res.render("browse.ejs", {
            pets,
            pagination: {
                current_page: page,
                total_pages: totalPages,
                total_count: petsWithImages.length
            },
            error: null,
            request: req,
            activeFilters
        });

    } catch (error) {
        console.error("Browse error:", error);
        res.status(500).render("browse.ejs", {
            pets: [],
            pagination: null,
            error: "Could not fetch pet data.",
            request: req,
            activeFilters: []
        });
    }

}




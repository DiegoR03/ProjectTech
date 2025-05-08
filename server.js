require("dotenv").config();

const express = require("express");
const app = express();
const session = require("express-session");
const port = 3000;

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

  .set("view engine", "ejs")
  .set("views", "view")

  .get("/", loadHome)

  .listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });

function loadHome(req, res) {
  req.session.userID = 95234;
  let userID = req.session.userID;
  res.render("index.ejs", { userID });
}

let Testtest = 4;

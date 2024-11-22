import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import env from "dotenv";

//password-related imports
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";

const app = express();
const port = process.env.PORT || 8080;

env.config({ path: "../.env" });

//conditional statement to enable CORS based on the environment
if (process.env.NODE_ENV === "development") {
  app.use(
    cors({
      origin: "http://localhost:5173",
      optionsSuccessStatus: 200,
      credentials: true,
    })
  );
}
const saltRounds = 10;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

// -- Authentication Section API --

app.get("/api/sessions", (req, res) => {
  if (req.isAuthenticated()) {
    res.status(200).json(req.user);
  } else {
    res.status(401).json({ error: "Not authenticated." });
  }
});

app.delete("/api/sessions", (req, res) => {
  req.logout(() => {
    res.end();
  });
});

app.post("/api/login", passport.authenticate("local"), (req, res) => {
  console.log(req.user.id, req.user.username);
  res.status(201).json(req.user);
});

app.post("/api/register", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      username,
    ]);

    if (checkResult.rows.length > 0) {
      res.status(403).json({ error: "Email already exists. Try logging in." });
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [username, hash]
          );
          const user = {
            id: result.rows[0].id,
            username: result.rows[0].email,
          };
          req.login(user, (err) => {
            console.log("success");
            res.status(201).json(user);
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

// Passport: set up localy strategy
passport.use(
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [
        username,
      ]);
      if (result.rows.length > 0) {
        const storedHashedPassword = result.rows[0].password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            //Error with password check
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              //Passed password check
              const user = {
                id: result.rows[0].id,
                username: result.rows[0].email,
              };
              console.log(user);
              return cb(null, user);
            } else {
              //Did not pass password check
              return cb(null, false);
            }
          }
        });
      } else {
        return cb(null, false);
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

// -- Birthdays Section API --

app.get("/api/data", async (req, res) => {
  if (req.isAuthenticated()) {
    console.log(req.user);
    try {
      const result = await db.query(
        "SELECT id, first_name, last_name, TO_CHAR(birthdate, 'yyyy-mm-dd') AS birthdate, comment FROM birthdays WHERE user_id = $1",
        [req.user.id]
      );
      console.log(result.rows);
      if (result.rows.length > 0) {
        res.status(200).json(result.rows);
      } else {
        res.status(200).json([]);
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      res.status(500).end();
    }
  } else {
    res.status(401).json({ error: "Not authenticated." });
  }
});

app.post("/api/data", async (req, res) => {
  const newItem = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    birthdate: req.body.birthdate,
    comment: req.body.comment,
  };

  if (req.isAuthenticated()) {
    console.log(req.user);

    try {
      const result = await db.query(
        "INSERT INTO birthdays (first_name, last_name, birthdate, comment, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, first_name, last_name, TO_CHAR(birthdate, 'yyyy-mm-dd') AS birthdate, comment",
        [
          newItem.firstName,
          newItem.lastName,
          newItem.birthdate,
          newItem.comment,
          req.user.id,
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      res.status(503).json({ error: "Impossible to create the birthday." });
    }
  } else {
    res.status(401).json({ error: "Not authenticated." });
  }
});

app.patch("/api/data/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const existingItem = list.find((item) => id === item.id);

  const replacementItem = {
    id: id,
    firstName: req.body.firstName || existingItem.firstName,
    lastName: req.body.lastName || existingItem.lastName,
    birthdate: req.body.birthdate || existingItem.birthdate,
    comment: req.body.comment || existingItem.comment,
  };

  const searchIndex = list.findIndex((item) => id === item.id);
  list[searchIndex] = replacementItem;

  console.log(list[searchIndex]);
  res.json(replacementItem);
});

app.delete("/api/data/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const searchIndex = list.findIndex((item) => item.id === id);

  if (searchIndex > -1) {
    list.splice(searchIndex, 1);
    res.sendStatus(200);
  } else {
    res.status(404).json({
      error: `Person with id: ${id} not found.`,
    });
  }
});

app.listen(port, () => {
  console.log(`API Server running on port ${port}`);
});

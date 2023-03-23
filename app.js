const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const app = express();
app.use(express.json());
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API1

app.post("/register/", async (request, response) => {
  const { name, username, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}'
          
        )`;
    const passWordLength = password.length;
    if (passWordLength < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const dbResponse = await db.run(createUserQuery);
      const newUserId = dbResponse.lastID;
      response.send("User created successfully");
    }
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

//login user API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
//API 3

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getTweetDetailsQuery = `SELECT * FROM user WHERE username='${username}';`;
  const userDetails = await db.get(getTweetDetailsQuery);
  const { user_id } = userDetails;

  const selectUserQuery = `SELECT tweet.tweet,tweet.date_time FROM follower INNER JOIN tweet on follower.follower_user_id=tweet.user_id WHERE tweet.user_id=${user_id};`;
  const userTweets = await db.all(selectUserQuery);
  response.send(userTweets);
});

//API4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getTweetDetailsQuery = `SELECT * FROM user WHERE username='${username}';`;
  const userDetails = await db.get(getTweetDetailsQuery);
  const { user_id } = userDetails;

  const getFollowingUserDetailsQuery = `SELECT * FROM user INNER JOIN follower on user.user_id=follower.follower_user_id WHERE user.user_id=${user_id};`;
  const getNames = await db.get(getFollowingUserDetailsQuery);

  const { following_user_id } = getNames;
  console.log(following_user_id);
  const getResult = `SELECT user.name FROM user WHERE user_id=${following_user_id};`;
  const names = await db.all(getResult);
  response.send(names);
});
//API 5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getTweetDetailsQuery = `SELECT * FROM user WHERE username='${username}';`;
  const userDetails = await db.get(getTweetDetailsQuery);
  const { user_id } = userDetails;

  const getResult = `SELECT user.name FROM user INNER JOIN follower on user.user_id=follower.following_user_id where user.user_id=${user_id};`;

  const names = await db.all(getResult);
  response.send(names);
});

module.exports = app;

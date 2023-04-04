const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbpath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeAndStartServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running on http://localhost:3000");
    });
  } catch (e) {
    console.log(`dbError:${e.message}`);
    process.exit(1);
  }
};

initializeAndStartServer();

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUser = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(selectUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passwordMatch = await bcrypt.compare(password, dbUser.password);
    if (passwordMatch) {
      let payload = username;
      const jwtToken = jwt.sign(payload, "SECRET_KEY");
      response.status(200);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const Authenticate = (request, response, next) => {
  let token;
  const authToken = request.headers["authorization"];
  if (authToken !== undefined) {
    token = authToken.split(" ")[1];
  }
  if (token === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    const validateToken = jwt.verify(token, "SECRET_KEY", (error, payload) => {
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

const StateConvertObject = (obj) => {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  };
};

const DistrictObject = (obj) => {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  };
};

//getstates

const getallstates = app.get(
  "/states/",
  Authenticate,
  async (request, response) => {
    const states = `SELECT * FROM state;`;
    const dbResponse = await db.all(states);
    let camelCase = [];
    for (let each of dbResponse) {
      let h = StateConvertObject(each);
      camelCase.push(h);
    }
    response.send(camelCase);
  }
);

//getspecificstate

const getspecificstate = app.get(
  "/states/:stateId/",
  Authenticate,
  async (request, response) => {
    const { stateId } = request.params;
    const state = `SELECT * FROM state WHERE state_id=${stateId};`;
    const dbResponse = await db.get(state);
    response.send(StateConvertObject(dbResponse));
  }
);

//add district

const adddistrict = app.post(
  "/districts/",
  Authenticate,
  async (request, response) => {
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const addDistrict = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths) VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
    const dbResponse = await db.run(addDistrict);
    response.send("District Successfully Added");
  }
);
//specific district
const specificdistrict = app.get(
  "/districts/:districtId/",
  Authenticate,
  async (request, response) => {
    const { districtId } = request.params;
    const dis = `SELECT * FROM district WHERE district_id=${districtId};`;
    const dbResponse = await db.get(dis);
    response.send(DistrictObject(dbResponse));
  }
);

//delete district

const deletedistrict = app.delete(
  "/districts/:districtId/",
  Authenticate,
  async (request, response) => {
    const { districtId } = request.params;
    const deletedis = `DELETE FROM district WHERE district_id=${districtId};`;
    const dbResponse = await db.run(deletedis);
    response.send("District Removed");
  }
);

//update district

const updatedistrict = app.put(
  "/districts/:districtId/",
  Authenticate,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updatedis = `UPDATE district SET district_name='${districtName}',state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths} WHERE district_id=${districtId};`;
    const dbResponse = await db.run(updatedis);
    response.send("District Details Updated");
  }
);

//specific state total cases

const totalcases = app.get(
  "/states/:stateId/stats/",
  Authenticate,
  async (request, response) => {
    const { stateId } = request.params;
    const details = `SELECT SUM(cases)AS totalCases,SUM(cured)AS totalCured,SUM(active)AS totalActive,SUM(deaths)AS totalDeaths FROM district WHERE state_id=${stateId};`;
    const dbResponse = await db.get(details);
    response.send(dbResponse);
  }
);

//specific district state details

const districtstatedetails = app.get(
  "/districts/:districtId/details/",
  Authenticate,
  async (request, response) => {
    const { districtId } = request.params;
    const disdetails = `SELECT * FROM state INNER JOIN district ON state.state_id=district.state_id WHERE district_id=${districtId};`;
    const dbResponse = await db.get(disdetails);
    response.send({ stateName: dbResponse.state_name });
  }
);

const stateDistrictMaintainence = {
  allstates: getallstates,
  specificstate: getspecificstate,
  addistrict: adddistrict,
  specificdistrict: specificdistrict,
  updatedistrict: updatedistrict,
  deletedistrict: deletedistrict,
  totalcases: totalcases,
  districtstatedetails: districtstatedetails,
  stateconvertobj: StateConvertObject,
  districtobj: DistrictObject,
};

module.exports = updatedistrict;

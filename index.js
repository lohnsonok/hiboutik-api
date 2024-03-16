require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
const saleRoute = require("./routes/sales");

app.use(express.json());
app.use("/api/webhook/hiboutik/sales", saleRoute);

app.listen(process.env.PORT, () => {
  console.log("Server is running");
});

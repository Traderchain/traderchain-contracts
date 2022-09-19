const Migrations = artifacts.require("Migrations");

// truffle exec shell/migrations.js --step 1 --network goerli
module.exports = async function(callback) {
  let {network, step} = config;
  console.log({network, step});
  
  await setCompleted(step);

  callback();
}

async function setCompleted(completed) {
  try {
    const migrations = await Migrations.deployed();
    let tx = await migrations.setCompleted(completed);    
    console.log("setCompleted: ", tx);
  }
  catch(err) {
    console.error(err);
  }
}

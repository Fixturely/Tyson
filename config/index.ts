const environment = process.env.NODE_ENV || 'development';
module.exports = Object.assign({}, require(`./${environment}`));
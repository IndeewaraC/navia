module.exports = {
  default: {
    paths: ['e2e/features/**/*.feature'],
    requireModule: ['ts-node/register'],
    require: ['e2e/steps/**/*.ts', 'e2e/support/**/*.ts'],
    format: ['summary', 'progress-bar', 'html:cucumber-report.html'],
    formatOptions: { snippetInterface: 'async-await' }
  }
}

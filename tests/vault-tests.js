var assert = require("test/assert");
var vault = require("vault");
var VaultMiddleware = vault.Middleware;
var Strategies = vault.Strategies;
var Unauthorized = vault.Unauthorized;
var MockRequest = require("jack/mock").MockRequest;
var ByteString = require("binary").ByteString;

exports.setup = function() {
    Strategies.clear();
};

exports.testAddStrategy = function(){
    Strategies.add(strategy);
};

exports.testAddsVaultToEnv = function(){
    var env;

    var app = helloApp(function(envp){
        env = envp;
    });

    new MockRequest(new VaultMiddleware(app, { vaultApp: vaultApp })).GET("/", { "jsgi.session": "", "jsgi.input": new ByteString("hello") });

    assert.isTrue(env["vault"] != undefined, "Should have contained key 'vault'");
};

exports.testAuthenticatesWithStrategy = function() {
    var hasCalledIsValid = false,
        hasCalledAuthenticate = false;

    Strategies.add({
        isValid: function(){
            hasCalledIsValid = true;
            return true;
        },
        authenticate: function(env){
            hasCalledAuthenticate = true;
            return true;
        }
    });

    var app = helloApp(function(env){
        env["vault"].authenticate();
    });

    new MockRequest(VaultMiddleware(app, { vaultApp: vaultApp })).GET("/", { "jsgi.session": "" });

    assert.isTrue(hasCalledIsValid, "Should have called strategies 'isValid' method");
    assert.isTrue(hasCalledAuthenticate, "Should have called strategies 'authenticate' method");
};

exports["test calls vault app when unauthorized"] = function() {
    var vaultAppCalled = false;

    Strategies.add({
        isValid: function(){
            return true;
        },
        authenticate: function(){
            return false;
        }
    });

    var app = helloApp(function(){
        throw new Unauthorized();
    });

    new MockRequest(new VaultMiddleware(app, { vaultApp: vaultApp(function() { vaultAppCalled = true; }) }))
            .GET("/", { "jsgi.session": "" });

    assert.isTrue(vaultAppCalled, "Should have called vault app");
};

var strategy = {
    isValid: function(){

    }
};

var helloApp = function(block) {
    return function(env) {
        if (block) {
            block(env);
        }

        return {
            status: 200,
            headers: { 'Content-Type': 'text/html'},
            body: ["hello"]
        };
    };
};

var vaultApp = function(block){
    return function(env) {
        if (block != undefined) {
            block(env);
        }
        return { status: 200, body: [] };
    };
};

if (require.main == module.id) {
    require("test/runner").run(exports);
}

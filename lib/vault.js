var Request = require("jack").Request;
var Session = require("jack/session").Session;

var defaultStrategies = [];

/**
 * Vault security service
 * @constructor
 */
var Vault = exports.Vault = function(env, vaultApp, strategies) {
    var session = new Session(env);
    
    return Object.create({
        /**
         * Authenticates a request
         * @return Whether the authentication succeded
         * @type Boolean
         */
        authenticate: function(){
            var strategy;
            var validStrategies;
            var i;
            var response = null;

            if (strategies.length == 0){
                throw new Error("No strategies registered");
            }

            validStrategies = strategies.filter(function(strategy) { return strategy.isValid(env); });
            if (validStrategies == null || validStrategies.length === 0) {
                log.debug("No valid authentication strategies for request");
            } else {
                for (i=0;i<validStrategies.length;++i) {
                    let shouldHalt = false;
                    strategy = validStrategies[i];
                    strategy.authenticate(env, {
                        success: function(user) {
                            env.vault.user = user;
                            session["vault_user"] = user;
                            this.halt();
                            response = true;
                        },
                        failure: function(message) {
                            response = false;
                            env.vault.message = message;
                            this.halt();
                        },
                        halt: function() {
                            shouldHalt = true;
                        },
                        /**
                         * Redircts to a URL.  URI encodes the URL.
                         * @param {String} url URL to redirect to
                         */
                        redirect: function(url) {
                            this.halt();
                            var headers = {};
                            HashP.set(headers, "Content-Type", "text/html");
                            HashP.set(headers, "Location", encodeURI(url));
                            response = {
                                status: 302,
                                headers: headers,
                                body: ["Please go to <a href='" + url + "'>this page</a>"]
                            };
                            return response;
                        }
                    });
                    if (shouldHalt) {
                        break;
                    }
                }
            }

            return response;
        },

        /**
         * End current user's session
         * @param {Boolean} useDefaultLogoutPage Whether the Vault App's logout page should be used
         * @return If useDefaultLogoutPage then returns response from Vault App, otherwise returns null.
         */
        logout: function(useDefaultLogoutPage) {
            useDefaultLogoutPage = useDefaultLogoutPage || true;

            delete session["vault_user"];
            env.vault.user = null;

            if (useDefaultLogoutPage) {
                env["PATH_INFO"] = "/logout";
                env["REQUEST_METHOD"] = "GET";
                return vaultApp(env);
            }

            return null;
        }
    });
};

var Middleware = exports.Middleware = function(app, options){
    var strategies = defaultStrategies;
    var vaultApp;

    options = options || {};

    if (typeof options.vaultApp === "undefined"){
        throw new Error("Vault App is required");
    }
    vaultApp = options.vaultApp;

    return function(env) {
        var session = new Session(env);
        var vault = null;

        if (typeof env.vault !== "undefined") {
            vault = env.vault;
        }

        if (typeof options.strategies !== "undefined") {
            strategies = options.strategies.concat(strategies);
        }

        if (Object.defineProperty !== undefined) {
            Object.defineProperty(env, "vault", {
                get: function() {
                    if (vault === null) {
                        vault = Vault(env, vaultApp, strategies);
                        vault.user = session["vault_user"] || null;
                    }
                    return vault;
                }
            });
        } else {
            vault = env.vault = Vault(env, vaultApp, strategies);
            vault.user = session["vault_user"] || null;
        }

        try {
            return app(env);
        } catch (err) {
            print(err);
            if (err instanceof Unauthorized){
                env["PATH_INFO"] = "/unauthorized";
                return vaultApp(env);
            }
            throw err;
        }
    };
};

/**
 * Strategies to be added by default to all vault instances
 */
var Strategies = exports.Strategies = {
    add: function(strategy){
        defaultStrategies.push(strategy);
    },
    clear: function() {
        defaultStrategies = [];
    }
};

function Unauthorized() {
    this.message = "unauthorized";
};

exports.Unauthorized = Unauthorized;


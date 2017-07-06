/**
 * 名称：webpack代码拆分插件，支持react同构处理
 * 日期：2017-07-05
 * 描述：用于执行webpack代码拆分
 *      同时支持异步加载模块，同步处理
 *      例如: 
 *          当拆分出:
 *          app.js
 *          login.js
 *          register.js
 *      如果同时引用了app.js与login.js 
 *      那么 require('login.js') 时返回的是  login.js原本模块
 *      否则 require('login.js')  返回的是一个异步加载login.js的函数
 */

var ParserHelpers = require("webpack/lib/ParserHelpers.js");
var Configure = require('./config.js');

var REPLACEMENT = "require.ensureModuleId";
var PAGES = 'pages';

/**
 * 插件构造函数
 */
function CodeSpliterPlugin() {
}

//require.ensureModuleId 变量
CodeSpliterPlugin.REPLACEMENT = REPLACEMENT;

/**
 * 配置loader
 * @param {Array<String>} splitPoints 拆分点
 * @param {String} name 拆分代码存放目录名称 默认:pages
 * @param {String} rootDir 如果splitPoints 中的项为相对路径 则rootDir为相对路径的相对目录 默认为process.cwd()
 */
CodeSpliterPlugin.configure = function (splitPoints,rootDir,name) {
    var dir = name || PAGES;
    var rootDir = rootDir || process.cwd();
    var configure = new Configure(dir, rootDir, splitPoints);
    return {
        includes: configure.includes,
        options: configure.options,
        loader: require.resolve('./loader.js')
    }
}

/**
 * 插件执行入口函数
 */
CodeSpliterPlugin.prototype.apply = function (compiler) {
    var thisContext = this;
    compiler.plugin('compilation', function (compilation, params) {
        thisContext.registryReplacement(params);
        thisContext.registryReplaceModuleId(compilation);
    })
}

/**
 * 注册替换解析表达式
 * 用于替换split-loader中的require.ensureModuleId
 */
CodeSpliterPlugin.prototype.registryReplacement = function (params) {
    params.normalModuleFactory.plugin("parser", function (parser) {
        parser.plugin('expression ' + REPLACEMENT, ParserHelpers.toConstantDependency(REPLACEMENT));
        parser.plugin('evaluate typeof ' + REPLACEMENT, ParserHelpers.evaluateToString('string'));
    })
}

/**
 * 注册替换require.ensureModuleId 为具体的module.id
 */
CodeSpliterPlugin.prototype.registryReplaceModuleId = function (compilation) {
    var findEnsureModuleId = this.findEnsureModuleId.bind(this);
    compilation.moduleTemplate.plugin('module', function (moduleSource, module, chunk, dependencyTemplates) {
        var source = moduleSource._source;
        if (source) {
            var originalId = findEnsureModuleId(module);
            source.replacements.forEach(function (replace) {
                if (replace[2] === REPLACEMENT) {
                    replace[2] = originalId;
                }
            })
        }
        return moduleSource;
    })
}

/**
 * 查找require.ensure依赖模块的module.id
 * @param {Module} module webpack加载的模块
 */
CodeSpliterPlugin.prototype.findEnsureModuleId = function (module) {
    var blocks = module.blocks;
    var id = -1;
    blocks.forEach(function (block) {
        block.dependencies.forEach(function (dep) {
            if (dep.module) {
                id = dep.module.id;
            }
        })
    })
    return id.toString();
}

module.exports = CodeSpliterPlugin;
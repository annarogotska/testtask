(function () {
  "use strict";

  class DCLogic {
    constructor(props) {
      this.props = props || {};
      this.state = {};
    }
    setState(patch) {
      this.state = Object.assign({}, this.state, patch);
      if (this._rerender) this._rerender();
    }
  }
  window.DCLogic = DCLogic;

  function lookup(scope, path) {
    if (path === "true") return true;
    if (path === "false") return false;
    var parts = path.split(".");
    var v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }

  var EXPR_G = /\{\{\s*([^}]+?)\s*\}\}/g;
  var WHOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;

  function interpolateString(str, scope) {
    return str.replace(EXPR_G, function (_, expr) {
      var v = lookup(scope, expr.trim());
      return v == null ? "" : String(v);
    });
  }

  function wholeExpr(str) {
    var m = str.match(WHOLE);
    return m ? m[1].trim() : null;
  }

  function renderNode(node, scope, out) {
    if (node.nodeType === 3) {
      out.appendChild(document.createTextNode(interpolateString(node.nodeValue, scope)));
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toLowerCase();

    if (tag === "sc-if") {
      var expr = wholeExpr(node.getAttribute("value") || "");
      var val = expr === null ? false : lookup(scope, expr);
      if (val) {
        for (var i = 0; i < node.childNodes.length; i++) renderNode(node.childNodes[i], scope, out);
      }
      return;
    }

    if (tag === "sc-for") {
      var listExpr = wholeExpr(node.getAttribute("list") || "");
      var list = listExpr === null ? [] : lookup(scope, listExpr) || [];
      var asName = node.getAttribute("as");
      list.forEach(function (item) {
        var cs = Object.assign({}, scope);
        cs[asName] = item;
        for (var i = 0; i < node.childNodes.length; i++) renderNode(node.childNodes[i], cs, out);
      });
      return;
    }

    var el = node.cloneNode(false);
    for (var a = el.attributes.length - 1; a >= 0; a--) {
      var attr = el.attributes[a];
      var name = attr.name;
      var value = attr.value;

      if (name === "onclick" || name === "onchange") {
        var fnExpr = wholeExpr(value);
        el.removeAttribute(name);
        if (fnExpr) {
          var fn = lookup(scope, fnExpr);
          if (typeof fn === "function") el.addEventListener(name === "onclick" ? "click" : "change", fn);
        }
        continue;
      }

      var we = wholeExpr(value);
      if (we !== null) {
        var v = lookup(scope, we);
        el.removeAttribute(name);
        if (name === "checked") {
          if (v) el.checked = true;
          continue;
        }
        if (v !== false && v != null) el.setAttribute(name, String(v));
      } else if (value.indexOf("{{") !== -1) {
        el.setAttribute(name, interpolateString(value, scope));
      }
    }
    out.appendChild(el);
    for (var c = 0; c < node.childNodes.length; c++) renderNode(node.childNodes[c], scope, el);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var xdc = document.querySelector("x-dc");
    if (!xdc) return;
    var helmet = xdc.querySelector("helmet");

    var templateRoot = document.createElement("div");
    Array.prototype.slice.call(xdc.childNodes).forEach(function (n) {
      if (n !== helmet) templateRoot.appendChild(n);
    });
    if (helmet) {
      Array.prototype.slice.call(helmet.childNodes).forEach(function (n) {
        document.head.appendChild(n);
      });
    }

    var scriptEl = document.querySelector("script[data-dc-script]");
    var propsSpec = JSON.parse(scriptEl.getAttribute("data-props") || "{}");
    var props = {};
    Object.keys(propsSpec).forEach(function (k) {
      if (k === "$preview") return;
      props[k] = propsSpec[k].default;
    });

    var code = scriptEl.textContent;
    var Component = new Function(code + "\n;return Component;")();
    var instance = new Component(props);

    var mount = document.createElement("div");
    xdc.replaceWith(mount);

    function rerender() {
      mount.innerHTML = "";
      var scope = instance.renderVals();
      Array.prototype.forEach.call(templateRoot.childNodes, function (n) {
        renderNode(n, scope, mount);
      });
    }
    instance._rerender = rerender;
    rerender();
  });
})();

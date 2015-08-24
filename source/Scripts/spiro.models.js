//  Copyright 2013-2014 Naked Objects Group Ltd
//  Licensed under the Apache License, Version 2.0(the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
// ABOUT THIS FILE:
// spiro.models defines a set of classes that correspond directly to the JSON representations returned by Restful Objects
// resources.  These classes provide convenient methods for navigating the contents of those representations, and for
// following links to other resources.
/// <reference path="typings/lodash/lodash.d.ts" />
/// <reference path="spiro.models.shims.ts" />
/// <reference path="spiro.config.ts" />
var Spiro;
(function (Spiro) {
    "use strict";
    function isScalarType(typeName) {
        return typeName === "string" || typeName === "number" || typeName === "boolean" || typeName === "integer";
    }
    function isListType(typeName) {
        return typeName === "list";
    }
    var RelParm = (function () {
        function RelParm(asString) {
            this.asString = asString;
            this.decomposeParm();
        }
        RelParm.prototype.decomposeParm = function () {
            var regex = /(\w+)\W+(\w+)\W+/;
            var result = regex.exec(this.asString);
            this.name = result[1], this.value = result[2];
        };
        return RelParm;
    })();
    Spiro.RelParm = RelParm;
    // rel helper class 
    var Rel = (function () {
        function Rel(asString) {
            this.asString = asString;
            this.ns = "";
            this.parms = [];
            this.decomposeRel();
        }
        Rel.prototype.decomposeRel = function () {
            var postFix;
            if (this.asString.substring(0, 3) === "urn") {
                // namespaced 
                this.ns = this.asString.substring(0, this.asString.indexOf("/") + 1);
                postFix = this.asString.substring(this.asString.indexOf("/") + 1);
            }
            else {
                postFix = this.asString;
            }
            var splitPostFix = postFix.split(";");
            this.uniqueValue = splitPostFix[0];
            if (splitPostFix.length > 1) {
                this.parms = _.map(splitPostFix.slice(1), function (s) { return new RelParm(s); });
            }
        };
        return Rel;
    })();
    Spiro.Rel = Rel;
    // Media type helper class 
    var MediaType = (function () {
        function MediaType(asString) {
            this.asString = asString;
            this.decomposeMediaType();
        }
        MediaType.prototype.decomposeMediaType = function () {
            var parms = this.asString.split(";");
            if (parms.length > 0) {
                this.applicationType = parms[0];
            }
            for (var i = 1; i < parms.length; i++) {
                if (parms[i].trim().substring(0, 7) === "profile") {
                    this.profile = parms[i].trim();
                    var profileValue = (this.profile.split("=")[1].replace(/\"/g, "")).trim();
                    this.representationType = (profileValue.split("/")[1]).trim();
                }
                if (parms[i].trim().substring(0, 16) === "x-ro-domain-type") {
                    this.xRoDomainType = (parms[i]).trim();
                    this.domainType = (this.xRoDomainType.split("=")[1].replace(/\"/g, "")).trim();
                }
            }
        };
        return MediaType;
    })();
    Spiro.MediaType = MediaType;
    // helper class for values 
    var Value = (function () {
        function Value(raw) {
            // can only be Link, number, boolean, string or null    
            if (raw instanceof Array) {
                this.wrapped = raw;
            }
            else if (raw instanceof Link) {
                this.wrapped = raw;
            }
            else if (raw && raw.href) {
                this.wrapped = new Link(raw);
            }
            else {
                this.wrapped = raw;
            }
        }
        Value.prototype.isReference = function () {
            return this.wrapped instanceof Link;
        };
        Value.prototype.isList = function () {
            return this.wrapped instanceof Array;
        };
        Value.prototype.isNull = function () {
            return this.wrapped == null;
        };
        Value.prototype.link = function () {
            return this.isReference() ? this.wrapped : null;
        };
        Value.prototype.scalar = function () {
            return this.isReference() ? null : this.wrapped;
        };
        Value.prototype.list = function () {
            if (this.isList()) {
                return _.map(this.wrapped, function (i) {
                    return new Value(i);
                });
            }
            return null;
        };
        Value.prototype.toString = function () {
            if (this.isReference()) {
                return this.link().title();
            }
            if (this.isList()) {
                var ss = _.map(this.list(), function (v) {
                    return v.toString();
                });
                if (ss.length === 0) {
                    return "";
                }
                return _.reduce(ss, function (m, s) {
                    return m + "-" + s;
                });
            }
            return (this.wrapped == null) ? "" : this.wrapped.toString();
        };
        Value.prototype.toValueString = function () {
            if (this.isReference()) {
                return this.link().href();
            }
            return (this.wrapped == null) ? "" : this.wrapped.toString();
        };
        Value.prototype.set = function (target, name) {
            if (name) {
                var t = target[name] = {};
                this.set(t);
            }
            else {
                if (this.isReference()) {
                    target["value"] = { "href": this.link().href() };
                }
                else {
                    target["value"] = this.scalar();
                }
            }
        };
        return Value;
    })();
    Spiro.Value = Value;
    // helper class for results 
    var Result = (function () {
        function Result(wrapped, resultType) {
            this.wrapped = wrapped;
            this.resultType = resultType;
        }
        Result.prototype.object = function () {
            if (!this.isNull() && this.resultType === "object") {
                return new DomainObjectRepresentation(this.wrapped);
            }
            return null;
        };
        Result.prototype.list = function () {
            if (!this.isNull() && this.resultType === "list") {
                return new ListRepresentation(this.wrapped);
            }
            return null;
        };
        Result.prototype.scalar = function () {
            if (!this.isNull() && this.resultType === "scalar") {
                return new ScalarValueRepresentation(this.wrapped);
            }
            return null;
        };
        Result.prototype.isNull = function () {
            return this.wrapped == null;
        };
        Result.prototype.isVoid = function () {
            return (this.resultType === "void");
        };
        return Result;
    })();
    Spiro.Result = Result;
    // base class for nested representations 
    var NestedRepresentation = (function () {
        function NestedRepresentation(wrapped) {
            this.wrapped = wrapped;
        }
        NestedRepresentation.prototype.links = function () {
            return Links.wrapLinks(this.wrapped.links);
        };
        NestedRepresentation.prototype.extensions = function () {
            return this.wrapped.extensions;
        };
        return NestedRepresentation;
    })();
    Spiro.NestedRepresentation = NestedRepresentation;
    // base class for all representations that can be directly loaded from the server 
    var HateoasModelBase = (function (_super) {
        __extends(HateoasModelBase, _super);
        function HateoasModelBase(object) {
            _super.call(this, object);
        }
        HateoasModelBase.prototype.onError = function (map, statusCode, warnings) {
            return new ErrorMap(map, statusCode, warnings);
        };
        return HateoasModelBase;
    })(Spiro.HateoasModelBaseShim);
    Spiro.HateoasModelBase = HateoasModelBase;
    var ErrorMap = (function (_super) {
        __extends(ErrorMap, _super);
        function ErrorMap(map, statusCode, warningMessage) {
            _super.call(this, map);
            this.statusCode = statusCode;
            this.warningMessage = warningMessage;
        }
        ErrorMap.prototype.valuesMap = function () {
            var vs = {}; // distinguish between value map and persist map 
            var map = this.attributes.members ? this.attributes.members : this.attributes;
            for (var v in map) {
                if (map[v].hasOwnProperty("value")) {
                    var ev = {
                        value: new Value(map[v].value),
                        invalidReason: map[v].invalidReason
                    };
                    vs[v] = ev;
                }
            }
            return vs;
        };
        ErrorMap.prototype.invalidReason = function () {
            return this.get("x-ro-invalid-reason");
        };
        return ErrorMap;
    })(HateoasModelBase);
    Spiro.ErrorMap = ErrorMap;
    var UpdateMap = (function (_super) {
        __extends(UpdateMap, _super);
        function UpdateMap(domainObject, map) {
            var _this = this;
            _super.call(this, map, domainObject, domainObject.instanceId());
            this.domainObject = domainObject;
            domainObject.updateLink().copyToHateoasModel(this);
            _.each(this.properties(), function (value, key) {
                _this.setProperty(key, value);
            });
        }
        UpdateMap.prototype.onChange = function () {
            // if the update map changes as a result of server changes (eg title changes) update the 
            // associated domain object
            this.domainObject.setFromUpdateMap(this);
        };
        UpdateMap.prototype.onError = function (map, statusCode, warnings) {
            return new ErrorMap(map, statusCode, warnings);
        };
        UpdateMap.prototype.properties = function () {
            return _.mapValues(this.attributes, function (v) { return new Value(v.value); });
        };
        UpdateMap.prototype.setProperty = function (name, value) {
            value.set(this.attributes, name);
        };
        return UpdateMap;
    })(Spiro.ArgumentMap);
    Spiro.UpdateMap = UpdateMap;
    var AddToRemoveFromMap = (function (_super) {
        __extends(AddToRemoveFromMap, _super);
        function AddToRemoveFromMap(collectionResource, map, add) {
            _super.call(this, map, collectionResource, collectionResource.instanceId());
            this.collectionResource = collectionResource;
            var link = add ? collectionResource.addToLink() : collectionResource.removeFromLink();
            link.copyToHateoasModel(this);
        }
        AddToRemoveFromMap.prototype.onChange = function () {
            // if the update map changes as a result of server changes (eg title changes) update the 
            // associated property
            this.collectionResource.setFromMap(this);
        };
        AddToRemoveFromMap.prototype.onError = function (map, statusCode, warnings) {
            return new ErrorMap(map, statusCode, warnings);
        };
        AddToRemoveFromMap.prototype.setValue = function (value) {
            value.set(this.attributes);
        };
        return AddToRemoveFromMap;
    })(Spiro.ArgumentMap);
    Spiro.AddToRemoveFromMap = AddToRemoveFromMap;
    var ModifyMap = (function (_super) {
        __extends(ModifyMap, _super);
        function ModifyMap(propertyResource, map) {
            _super.call(this, map, propertyResource, propertyResource.instanceId());
            this.propertyResource = propertyResource;
            propertyResource.modifyLink().copyToHateoasModel(this);
            this.setValue(propertyResource.value());
        }
        ModifyMap.prototype.onChange = function () {
            // if the update map changes as a result of server changes (eg title changes) update the 
            // associated property
            this.propertyResource.setFromModifyMap(this);
        };
        ModifyMap.prototype.onError = function (map, statusCode, warnings) {
            return new ErrorMap(map, statusCode, warnings);
        };
        ModifyMap.prototype.setValue = function (value) {
            value.set(this.attributes);
        };
        return ModifyMap;
    })(Spiro.ArgumentMap);
    Spiro.ModifyMap = ModifyMap;
    var ModifyMapv11 = (function (_super) {
        __extends(ModifyMapv11, _super);
        function ModifyMapv11(propertyResource, id, map) {
            _super.call(this, map, propertyResource, id);
            this.propertyResource = propertyResource;
            propertyResource.modifyLink().copyToHateoasModel(this);
            this.setValue(propertyResource.value());
        }
        ModifyMapv11.prototype.onChange = function () {
            // if the update map changes as a result of server changes (eg title changes) update the 
            // associated property
            this.propertyResource.setFromModifyMap(this);
        };
        ModifyMapv11.prototype.onError = function (map, statusCode, warnings) {
            return new ErrorMap(map, statusCode, warnings);
        };
        ModifyMapv11.prototype.setValue = function (value) {
            value.set(this.attributes);
        };
        return ModifyMapv11;
    })(Spiro.ArgumentMap);
    Spiro.ModifyMapv11 = ModifyMapv11;
    var ClearMap = (function (_super) {
        __extends(ClearMap, _super);
        function ClearMap(propertyResource) {
            _super.call(this, {}, propertyResource, propertyResource.instanceId());
            propertyResource.clearLink().copyToHateoasModel(this);
        }
        ClearMap.prototype.onError = function (map, statusCode, warnings) {
            return new ErrorMap(map, statusCode, warnings);
        };
        return ClearMap;
    })(Spiro.ArgumentMap);
    Spiro.ClearMap = ClearMap;
    var ClearMapv11 = (function (_super) {
        __extends(ClearMapv11, _super);
        function ClearMapv11(propertyResource, id) {
            _super.call(this, {}, propertyResource, id);
            propertyResource.clearLink().copyToHateoasModel(this);
        }
        ClearMapv11.prototype.onError = function (map, statusCode, warnings) {
            return new ErrorMap(map, statusCode, warnings);
        };
        return ClearMapv11;
    })(Spiro.ArgumentMap);
    Spiro.ClearMapv11 = ClearMapv11;
    // helper - collection of Links 
    var Links = (function (_super) {
        __extends(Links, _super);
        // cannot use constructor to initialise as model property is not yet set and so will 
        // not create members of correct type 
        function Links() {
            var _this = this;
            _super.call(this);
            this.model = Link;
            this.url = function () {
                return _this.hateoasUrl;
            };
        }
        Links.prototype.parse = function (response) {
            return response.value;
        };
        Links.wrapLinks = function (links) {
            var ll = new Links();
            ll.add(links);
            return ll;
        };
        // returns first link of rel
        Links.prototype.getLinkByRel = function (rel) {
            return _.find(this.models, function (i) {
                return i.rel().uniqueValue === rel.uniqueValue;
            });
        };
        Links.prototype.linkByRel = function (rel) {
            return this.getLinkByRel(new Rel(rel));
        };
        return Links;
    })(Spiro.CollectionShim);
    Spiro.Links = Links;
    // REPRESENTATIONS
    var ResourceRepresentation = (function (_super) {
        __extends(ResourceRepresentation, _super);
        function ResourceRepresentation(object) {
            _super.call(this, object);
        }
        ResourceRepresentation.prototype.links = function () {
            this.lazyLinks = this.lazyLinks || Links.wrapLinks(this.get("links"));
            return this.lazyLinks;
        };
        ResourceRepresentation.prototype.extensions = function () {
            return this.get("extensions");
        };
        return ResourceRepresentation;
    })(HateoasModelBase);
    Spiro.ResourceRepresentation = ResourceRepresentation;
    // matches a action invoke resource 19.0 representation 
    var ActionResultRepresentation = (function (_super) {
        __extends(ActionResultRepresentation, _super);
        function ActionResultRepresentation(object) {
            _super.call(this, object);
        }
        // links 
        ActionResultRepresentation.prototype.selfLink = function () {
            return this.links().linkByRel("self");
        };
        // link representations 
        ActionResultRepresentation.prototype.getSelf = function () {
            return this.selfLink().getTarget();
        };
        // properties 
        ActionResultRepresentation.prototype.resultType = function () {
            return this.get("resultType");
        };
        ActionResultRepresentation.prototype.result = function () {
            return new Result(this.get("result"), this.resultType());
        };
        // helper
        ActionResultRepresentation.prototype.setParameter = function (name, value) {
            value.set(this.attributes, name);
        };
        return ActionResultRepresentation;
    })(ResourceRepresentation);
    Spiro.ActionResultRepresentation = ActionResultRepresentation;
    // matches an action representation 18.0 
    // matches 18.2.1
    var Parameter = (function (_super) {
        __extends(Parameter, _super);
        // fix parent type
        function Parameter(wrapped, parent) {
            _super.call(this, wrapped);
            this.parent = parent;
        }
        // properties 
        Parameter.prototype.choices = function () {
            // use custom choices extension by preference 
            if (this.extensions()["x-ro-nof-choices"]) {
                return _.mapValues(this.extensions()["x-ro-nof-choices"], function (v) { return new Value(v); });
            }
            if (this.wrapped.choices) {
                var values = _.map(this.wrapped.choices, function (item) { return new Value(item); });
                return _.object(_.map(values, function (v) { return [v.toString(), v]; }));
            }
            return null;
        };
        Parameter.prototype.promptLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/prompt");
        };
        Parameter.prototype.getPrompts = function () {
            return this.promptLink().getTarget();
        };
        Parameter.prototype.default = function () {
            return new Value(this.wrapped.default);
        };
        // helper
        Parameter.prototype.isScalar = function () {
            return isScalarType(this.extensions().returnType) ||
                (isListType(this.extensions().returnType) && isScalarType(this.extensions().elementType));
        };
        Parameter.prototype.hasPrompt = function () {
            return !!this.promptLink();
        };
        return Parameter;
    })(NestedRepresentation);
    Spiro.Parameter = Parameter;
    var ActionRepresentation = (function (_super) {
        __extends(ActionRepresentation, _super);
        function ActionRepresentation() {
            _super.apply(this, arguments);
        }
        // links 
        ActionRepresentation.prototype.selfLink = function () {
            return this.links().linkByRel("self");
        };
        ActionRepresentation.prototype.upLink = function () {
            return this.links().linkByRel("up");
        };
        ActionRepresentation.prototype.invokeLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/invoke");
        };
        // linked representations 
        ActionRepresentation.prototype.getSelf = function () {
            return this.selfLink().getTarget();
        };
        ActionRepresentation.prototype.getUp = function () {
            return this.upLink().getTarget();
        };
        ActionRepresentation.prototype.getInvoke = function () {
            return this.invokeLink().getTarget();
        };
        // properties 
        ActionRepresentation.prototype.actionId = function () {
            return this.get("id");
        };
        ActionRepresentation.prototype.initParameterMap = function () {
            var _this = this;
            if (!this.parameterMap) {
                var parameters = this.get("parameters");
                this.parameterMap = _.mapValues(parameters, function (p) { return new Parameter(p, _this); });
            }
        };
        ActionRepresentation.prototype.parameters = function () {
            this.initParameterMap();
            return this.parameterMap;
        };
        ActionRepresentation.prototype.disabledReason = function () {
            return this.get("disabledReason");
        };
        return ActionRepresentation;
    })(ResourceRepresentation);
    Spiro.ActionRepresentation = ActionRepresentation;
    // new in 1.1 15.0 in spec 
    var PromptRepresentation = (function (_super) {
        __extends(PromptRepresentation, _super);
        function PromptRepresentation() {
            _super.apply(this, arguments);
        }
        // links 
        PromptRepresentation.prototype.selfLink = function () {
            return this.links().linkByRel("self");
        };
        PromptRepresentation.prototype.upLink = function () {
            return this.links().linkByRel("up");
        };
        // linked representations 
        PromptRepresentation.prototype.getSelf = function () {
            return this.selfLink().getTarget();
        };
        PromptRepresentation.prototype.getUp = function () {
            return this.upLink().getTarget();
        };
        // properties 
        PromptRepresentation.prototype.instanceId = function () {
            return this.get("id");
        };
        PromptRepresentation.prototype.choices = function () {
            var ch = this.get("choices");
            if (ch) {
                var values = _.map(ch, function (item) { return new Value(item); });
                return _.object(_.map(values, function (v) { return [v.toString(), v]; }));
            }
            return null;
        };
        PromptRepresentation.prototype.reset = function () {
            this.attributes = {};
        };
        PromptRepresentation.prototype.setSearchTerm = function (term) {
            this.set("x-ro-searchTerm", { "value": term });
        };
        PromptRepresentation.prototype.setArgument = function (name, val) {
            val.set(this.attributes, name);
        };
        PromptRepresentation.prototype.setArguments = function (args) {
            var _this = this;
            _.each(args, function (arg, key) { return _this.setArgument(key, arg); });
        };
        return PromptRepresentation;
    })(ResourceRepresentation);
    Spiro.PromptRepresentation = PromptRepresentation;
    // matches a collection representation 17.0 
    var CollectionRepresentation = (function (_super) {
        __extends(CollectionRepresentation, _super);
        function CollectionRepresentation() {
            _super.apply(this, arguments);
        }
        // links 
        CollectionRepresentation.prototype.selfLink = function () {
            return this.links().linkByRel("self");
        };
        CollectionRepresentation.prototype.upLink = function () {
            return this.links().linkByRel("up");
        };
        CollectionRepresentation.prototype.addToLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/add-to");
        };
        CollectionRepresentation.prototype.removeFromLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/remove-from");
        };
        // linked representations 
        CollectionRepresentation.prototype.getSelf = function () {
            return this.selfLink().getTarget();
        };
        CollectionRepresentation.prototype.getUp = function () {
            return this.upLink().getTarget();
        };
        CollectionRepresentation.prototype.setFromMap = function (map) {
            this.set(map.attributes);
        };
        CollectionRepresentation.prototype.addToMap = function () {
            return this.addToLink().arguments();
        };
        CollectionRepresentation.prototype.getAddToMap = function () {
            if (this.addToLink()) {
                return new AddToRemoveFromMap(this, this.addToMap(), true);
            }
            return null;
        };
        CollectionRepresentation.prototype.removeFromMap = function () {
            return this.removeFromLink().arguments();
        };
        CollectionRepresentation.prototype.getRemoveFromMap = function () {
            if (this.removeFromLink()) {
                return new AddToRemoveFromMap(this, this.removeFromMap(), false);
            }
            return null;
        };
        // properties 
        CollectionRepresentation.prototype.instanceId = function () {
            return this.get("id");
        };
        CollectionRepresentation.prototype.value = function () {
            return Links.wrapLinks(this.get("value"));
        };
        CollectionRepresentation.prototype.disabledReason = function () {
            return this.get("disabledReason");
        };
        return CollectionRepresentation;
    })(ResourceRepresentation);
    Spiro.CollectionRepresentation = CollectionRepresentation;
    // matches a property representation 16.0 
    var PropertyRepresentation = (function (_super) {
        __extends(PropertyRepresentation, _super);
        function PropertyRepresentation() {
            _super.apply(this, arguments);
        }
        // links 
        PropertyRepresentation.prototype.modifyLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/modify");
        };
        PropertyRepresentation.prototype.clearLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/clear");
        };
        PropertyRepresentation.prototype.selfLink = function () {
            return this.links().linkByRel("self");
        };
        PropertyRepresentation.prototype.upLink = function () {
            return this.links().linkByRel("up");
        };
        PropertyRepresentation.prototype.promptLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/prompt");
        };
        PropertyRepresentation.prototype.modifyMap = function () {
            return this.modifyLink().arguments();
        };
        // linked representations 
        PropertyRepresentation.prototype.getSelf = function () {
            return this.selfLink().getTarget();
        };
        PropertyRepresentation.prototype.getUp = function () {
            return this.upLink().getTarget();
        };
        PropertyRepresentation.prototype.setFromModifyMap = function (map) {
            this.set(map.attributes);
        };
        PropertyRepresentation.prototype.getModifyMap = function () {
            if (this.modifyLink()) {
                return new ModifyMap(this, this.modifyMap());
            }
            return null;
        };
        PropertyRepresentation.prototype.getClearMap = function () {
            if (this.clearLink()) {
                return new ClearMap(this);
            }
            return null;
        };
        PropertyRepresentation.prototype.getPrompts = function () {
            return this.promptLink().getTarget();
        };
        // properties 
        PropertyRepresentation.prototype.instanceId = function () {
            return this.get("id");
        };
        PropertyRepresentation.prototype.value = function () {
            return new Value(this.get("value"));
        };
        PropertyRepresentation.prototype.choices = function () {
            // use custom choices extension by preference 
            if (this.extensions()["x-ro-nof-choices"]) {
                return _.mapValues(this.extensions()["x-ro-nof-choices"], function (v) { return new Value(v); });
            }
            var ch = this.get("choices");
            if (ch) {
                var values = _.map(ch, function (item) { return new Value(item); });
                return _.object(_.map(values, function (v) { return [v.toString(), v]; }));
            }
            return null;
        };
        PropertyRepresentation.prototype.disabledReason = function () {
            return this.get("disabledReason");
        };
        // helper 
        PropertyRepresentation.prototype.isScalar = function () {
            return isScalarType(this.extensions().returnType);
        };
        PropertyRepresentation.prototype.hasPrompt = function () {
            return !!this.promptLink();
        };
        return PropertyRepresentation;
    })(ResourceRepresentation);
    Spiro.PropertyRepresentation = PropertyRepresentation;
    // matches a domain object representation 14.0 
    // base class for 14.4.1/2/3
    var Member = (function (_super) {
        __extends(Member, _super);
        function Member(wrapped, parent) {
            _super.call(this, wrapped);
            this.parent = parent;
        }
        Member.prototype.update = function (newValue) {
            this.wrapped = newValue;
        };
        Member.prototype.memberType = function () {
            return this.wrapped.memberType;
        };
        Member.prototype.detailsLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/details");
        };
        Member.prototype.disabledReason = function () {
            return this.wrapped.disabledReason;
        };
        Member.prototype.isScalar = function () {
            return isScalarType(this.extensions().returnType);
        };
        Member.wrapMember = function (toWrap, parent, id) {
            if (toWrap.memberType === "property") {
                return new PropertyMember(toWrap, parent, id);
            }
            if (toWrap.memberType === "collection") {
                return new CollectionMember(toWrap, parent, id);
            }
            if (toWrap.memberType === "action") {
                return new ActionMember(toWrap, parent, id);
            }
            return null;
        };
        return Member;
    })(NestedRepresentation);
    Spiro.Member = Member;
    // matches 14.4.1
    var PropertyMember = (function (_super) {
        __extends(PropertyMember, _super);
        function PropertyMember(wrapped, parent, id) {
            _super.call(this, wrapped, parent);
            this.id = id;
        }
        // inlined 
        PropertyMember.prototype.propertyId = function () {
            return this.id;
        };
        PropertyMember.prototype.modifyLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/modify");
        };
        PropertyMember.prototype.clearLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/clear");
        };
        PropertyMember.prototype.modifyMap = function () {
            return this.modifyLink().arguments();
        };
        PropertyMember.prototype.setFromModifyMap = function (map) {
            var _this = this;
            _.forOwn(map.attributes, function (v, k) {
                _this.wrapped[k] = v;
            });
        };
        PropertyMember.prototype.getModifyMap = function (id) {
            if (this.modifyLink()) {
                return new ModifyMapv11(this, id, this.modifyMap());
            }
            return null;
        };
        PropertyMember.prototype.getClearMap = function (id) {
            if (this.clearLink()) {
                return new ClearMapv11(this, id);
            }
            return null;
        };
        PropertyMember.prototype.getPrompts = function () {
            return this.promptLink().getTarget();
        };
        //
        PropertyMember.prototype.value = function () {
            return new Value(this.wrapped.value);
        };
        PropertyMember.prototype.update = function (newValue) {
            _super.prototype.update.call(this, newValue);
        };
        PropertyMember.prototype.attachmentLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/attachment");
        };
        PropertyMember.prototype.promptLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/prompt");
        };
        PropertyMember.prototype.getDetails = function () {
            return this.detailsLink().getTarget();
        };
        PropertyMember.prototype.hasChoices = function () {
            return this.wrapped.hasChoices;
        };
        PropertyMember.prototype.hasPrompt = function () {
            return !!this.promptLink();
        };
        PropertyMember.prototype.choices = function () {
            // use custom choices extension by preference 
            if (this.extensions()["x-ro-nof-choices"]) {
                return _.mapValues(this.extensions()["x-ro-nof-choices"], function (v) { return new Value(v); });
            }
            var ch = this.wrapped.choices;
            if (ch) {
                var values = _.map(ch, function (item) { return new Value(item); });
                return _.object(_.map(values, function (v) { return [v.toString(), v]; }));
            }
            return null;
        };
        return PropertyMember;
    })(Member);
    Spiro.PropertyMember = PropertyMember;
    // matches 14.4.2 
    var CollectionMember = (function (_super) {
        __extends(CollectionMember, _super);
        function CollectionMember(wrapped, parent, id) {
            _super.call(this, wrapped, parent);
            this.id = id;
        }
        CollectionMember.prototype.collectionId = function () {
            return this.id;
        };
        CollectionMember.prototype.value = function () {
            return Links.wrapLinks(this.wrapped.value);
        };
        CollectionMember.prototype.size = function () {
            return this.wrapped.size;
        };
        CollectionMember.prototype.getDetails = function () {
            return this.detailsLink().getTarget();
        };
        return CollectionMember;
    })(Member);
    Spiro.CollectionMember = CollectionMember;
    // matches 14.4.3 
    var ActionMember = (function (_super) {
        __extends(ActionMember, _super);
        function ActionMember(wrapped, parent, id) {
            _super.call(this, wrapped, parent);
            this.id = id;
        }
        ActionMember.prototype.actionId = function () {
            return this.id;
        };
        ActionMember.prototype.getDetails = function () {
            return this.detailsLink().getTarget();
        };
        // 1.1 inlined 
        ActionMember.prototype.invokeLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/invoke");
        };
        ActionMember.prototype.getInvoke = function () {
            return this.invokeLink().getTarget();
        };
        ActionMember.prototype.initParameterMap = function () {
            var _this = this;
            if (!this.parameterMap) {
                var parameters = this.wrapped.parameters;
                this.parameterMap = _.mapValues(parameters, function (p) { return new Parameter(p, _this); });
            }
        };
        ActionMember.prototype.parameters = function () {
            this.initParameterMap();
            return this.parameterMap;
        };
        ActionMember.prototype.disabledReason = function () {
            return this.wrapped.disabledReason;
        };
        return ActionMember;
    })(Member);
    Spiro.ActionMember = ActionMember;
    var DomainObjectRepresentation = (function (_super) {
        __extends(DomainObjectRepresentation, _super);
        function DomainObjectRepresentation(object) {
            _super.call(this, object);
            this.url = this.getUrl;
        }
        DomainObjectRepresentation.prototype.getUrl = function () {
            return this.hateoasUrl || this.selfLink().href();
        };
        DomainObjectRepresentation.prototype.title = function () {
            return this.get("title");
        };
        DomainObjectRepresentation.prototype.domainType = function () {
            return this.get("domainType");
        };
        DomainObjectRepresentation.prototype.serviceId = function () {
            return this.get("serviceId");
        };
        DomainObjectRepresentation.prototype.links = function () {
            return Links.wrapLinks(this.get("links"));
        };
        DomainObjectRepresentation.prototype.instanceId = function () {
            return this.get("instanceId");
        };
        DomainObjectRepresentation.prototype.extensions = function () {
            return this.get("extensions");
        };
        DomainObjectRepresentation.prototype.resetMemberMaps = function () {
            var _this = this;
            var members = this.get("members");
            this.memberMap = _.mapValues(members, function (m, id) { return Member.wrapMember(m, _this, id); });
            this.propertyMemberMap = _.pick(this.memberMap, function (m) { return m.memberType() === "property"; });
            this.collectionMemberMap = _.pick(this.memberMap, function (m) { return m.memberType() === "collection"; });
            this.actionMemberMap = _.pick(this.memberMap, function (m) { return m.memberType() === "action"; });
        };
        DomainObjectRepresentation.prototype.initMemberMaps = function () {
            if (!this.memberMap) {
                this.resetMemberMaps();
            }
        };
        DomainObjectRepresentation.prototype.members = function () {
            this.initMemberMaps();
            return this.memberMap;
        };
        DomainObjectRepresentation.prototype.propertyMembers = function () {
            this.initMemberMaps();
            return this.propertyMemberMap;
        };
        DomainObjectRepresentation.prototype.collectionMembers = function () {
            this.initMemberMaps();
            return this.collectionMemberMap;
        };
        DomainObjectRepresentation.prototype.actionMembers = function () {
            this.initMemberMaps();
            return this.actionMemberMap;
        };
        DomainObjectRepresentation.prototype.member = function (id) {
            return this.members()[id];
        };
        DomainObjectRepresentation.prototype.propertyMember = function (id) {
            return this.propertyMembers()[id];
        };
        DomainObjectRepresentation.prototype.collectionMember = function (id) {
            return this.collectionMembers()[id];
        };
        DomainObjectRepresentation.prototype.actionMember = function (id) {
            return this.actionMembers()[id];
        };
        DomainObjectRepresentation.prototype.updateLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/update");
        };
        DomainObjectRepresentation.prototype.persistLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/persist");
        };
        DomainObjectRepresentation.prototype.selfLink = function () {
            return this.links().linkByRel("self");
        };
        DomainObjectRepresentation.prototype.updateMap = function () {
            return this.updateLink().arguments();
        };
        DomainObjectRepresentation.prototype.persistMap = function () {
            return this.persistLink().arguments();
        };
        // linked representations 
        DomainObjectRepresentation.prototype.getSelf = function () {
            return this.selfLink().getTarget();
        };
        DomainObjectRepresentation.prototype.getPersistMap = function () {
            return new PersistMap(this, this.persistMap());
        };
        DomainObjectRepresentation.prototype.getUpdateMap = function () {
            return new UpdateMap(this, this.updateMap());
        };
        DomainObjectRepresentation.prototype.setFromUpdateMap = function (map) {
            _.forOwn(this.members(), function (m, k) {
                m.update(map.attributes.members[k]);
            });
            // to trigger an update on the domainobject
            this.set(map.attributes);
        };
        DomainObjectRepresentation.prototype.setFromPersistMap = function (map) {
            // to trigger an update on the domainobject
            this.set(map.attributes);
            this.resetMemberMaps();
        };
        DomainObjectRepresentation.prototype.preFetch = function () {
            this.memberMap = null; // to ensure everything gets reset
        };
        return DomainObjectRepresentation;
    })(ResourceRepresentation);
    Spiro.DomainObjectRepresentation = DomainObjectRepresentation;
    var MenuRepresentation = (function (_super) {
        __extends(MenuRepresentation, _super);
        function MenuRepresentation(object) {
            _super.call(this, object);
            this.url = this.getUrl;
        }
        MenuRepresentation.prototype.getUrl = function () {
            return this.hateoasUrl || this.selfLink().href();
        };
        MenuRepresentation.prototype.title = function () {
            return this.get("title");
        };
        MenuRepresentation.prototype.links = function () {
            return Links.wrapLinks(this.get("links"));
        };
        MenuRepresentation.prototype.extensions = function () {
            return this.get("extensions");
        };
        MenuRepresentation.prototype.resetMemberMaps = function () {
            var _this = this;
            var members = this.get("members");
            this.memberMap = _.mapValues(members, function (m, id) { return Member.wrapMember(m, _this, id); });
            this.actionMemberMap = _.pick(this.memberMap, function (m) { return m.memberType() === "action"; });
        };
        MenuRepresentation.prototype.initMemberMaps = function () {
            if (!this.memberMap) {
                this.resetMemberMaps();
            }
        };
        MenuRepresentation.prototype.members = function () {
            this.initMemberMaps();
            return this.memberMap;
        };
        MenuRepresentation.prototype.actionMembers = function () {
            this.initMemberMaps();
            return this.actionMemberMap;
        };
        MenuRepresentation.prototype.member = function (id) {
            return this.members()[id];
        };
        MenuRepresentation.prototype.actionMember = function (id) {
            return this.actionMembers()[id];
        };
        MenuRepresentation.prototype.selfLink = function () {
            return this.links().linkByRel("self");
        };
        // linked representations 
        MenuRepresentation.prototype.getSelf = function () {
            return this.selfLink().getTarget();
        };
        MenuRepresentation.prototype.preFetch = function () {
            this.memberMap = null; // to ensure everything gets reset
        };
        return MenuRepresentation;
    })(ResourceRepresentation);
    Spiro.MenuRepresentation = MenuRepresentation;
    // matches scalar representation 12.0 
    var ScalarValueRepresentation = (function (_super) {
        __extends(ScalarValueRepresentation, _super);
        function ScalarValueRepresentation(wrapped) {
            _super.call(this, wrapped);
        }
        ScalarValueRepresentation.prototype.value = function () {
            return new Value(this.wrapped.value);
        };
        return ScalarValueRepresentation;
    })(NestedRepresentation);
    Spiro.ScalarValueRepresentation = ScalarValueRepresentation;
    // matches List Representation 11.0
    var ListRepresentation = (function (_super) {
        __extends(ListRepresentation, _super);
        function ListRepresentation(object) {
            _super.call(this, object);
        }
        // links
        ListRepresentation.prototype.selfLink = function () {
            return this.links().linkByRel("self");
        };
        // linked representations 
        ListRepresentation.prototype.getSelf = function () {
            return this.selfLink().getTarget();
        };
        // list of links to services 
        ListRepresentation.prototype.value = function () {
            return Links.wrapLinks(this.get("value"));
        };
        return ListRepresentation;
    })(ResourceRepresentation);
    Spiro.ListRepresentation = ListRepresentation;
    // matches the error representation 10.0 
    var ErrorRepresentation = (function (_super) {
        __extends(ErrorRepresentation, _super);
        function ErrorRepresentation(object) {
            _super.call(this, object);
        }
        // scalar properties 
        ErrorRepresentation.prototype.message = function () {
            return this.get("message");
        };
        ErrorRepresentation.prototype.stacktrace = function () {
            return this.get("stackTrace");
        };
        ErrorRepresentation.prototype.causedBy = function () {
            var cb = this.get("causedBy");
            return cb ? new ErrorRepresentation(cb) : null;
        };
        return ErrorRepresentation;
    })(ResourceRepresentation);
    Spiro.ErrorRepresentation = ErrorRepresentation;
    // matches Objects of Type Resource 9.0 
    var PersistMap = (function (_super) {
        __extends(PersistMap, _super);
        function PersistMap(domainObject, map) {
            _super.call(this, map, domainObject, domainObject.instanceId());
            this.domainObject = domainObject;
            domainObject.persistLink().copyToHateoasModel(this);
        }
        PersistMap.prototype.onChange = function () {
            this.domainObject.setFromPersistMap(this);
        };
        PersistMap.prototype.onError = function (map, statusCode, warnings) {
            return new ErrorMap(map, statusCode, warnings);
        };
        PersistMap.prototype.setMember = function (name, value) {
            value.set(this.attributes["members"], name);
        };
        return PersistMap;
    })(Spiro.ArgumentMap);
    Spiro.PersistMap = PersistMap;
    // matches the version representation 8.0 
    var VersionRepresentation = (function (_super) {
        __extends(VersionRepresentation, _super);
        function VersionRepresentation() {
            _super.call(this);
        }
        // links 
        VersionRepresentation.prototype.selfLink = function () {
            return this.links().linkByRel("self");
        };
        VersionRepresentation.prototype.upLink = function () {
            return this.links().linkByRel("up");
        };
        // linked representations 
        VersionRepresentation.prototype.getSelf = function () {
            return this.selfLink().getTarget();
        };
        VersionRepresentation.prototype.getUp = function () {
            return this.upLink().getTarget();
        };
        // scalar properties 
        VersionRepresentation.prototype.specVersion = function () {
            return this.get("specVersion");
        };
        VersionRepresentation.prototype.implVersion = function () {
            return this.get("implVersion");
        };
        VersionRepresentation.prototype.optionalCapabilities = function () {
            return this.get("optionalCapabilities");
        };
        return VersionRepresentation;
    })(ResourceRepresentation);
    Spiro.VersionRepresentation = VersionRepresentation;
    // matches Domain Services Representation 7.0
    var DomainServicesRepresentation = (function (_super) {
        __extends(DomainServicesRepresentation, _super);
        function DomainServicesRepresentation() {
            _super.apply(this, arguments);
        }
        // links
        DomainServicesRepresentation.prototype.upLink = function () {
            return this.links().linkByRel("up");
        };
        // linked representations 
        DomainServicesRepresentation.prototype.getSelf = function () {
            return this.selfLink().getTarget();
        };
        DomainServicesRepresentation.prototype.getUp = function () {
            return this.upLink().getTarget();
        };
        return DomainServicesRepresentation;
    })(ListRepresentation);
    Spiro.DomainServicesRepresentation = DomainServicesRepresentation;
    // custom
    var MenusRepresentation = (function (_super) {
        __extends(MenusRepresentation, _super);
        function MenusRepresentation() {
            _super.apply(this, arguments);
        }
        // links
        MenusRepresentation.prototype.upLink = function () {
            return this.links().linkByRel("up");
        };
        // linked representations 
        MenusRepresentation.prototype.getSelf = function () {
            return this.selfLink().getTarget();
        };
        MenusRepresentation.prototype.getUp = function () {
            return this.upLink().getTarget();
        };
        return MenusRepresentation;
    })(ListRepresentation);
    Spiro.MenusRepresentation = MenusRepresentation;
    // matches the user representation 6.0
    var UserRepresentation = (function (_super) {
        __extends(UserRepresentation, _super);
        function UserRepresentation() {
            _super.apply(this, arguments);
        }
        // links 
        UserRepresentation.prototype.selfLink = function () {
            return this.links().linkByRel("self");
        };
        UserRepresentation.prototype.upLink = function () {
            return this.links().linkByRel("up");
        };
        // linked representations 
        UserRepresentation.prototype.getSelf = function () {
            return this.selfLink().getTarget();
        };
        UserRepresentation.prototype.getUp = function () {
            return this.upLink().getTarget();
        };
        // scalar properties 
        UserRepresentation.prototype.userName = function () {
            return this.get("userName");
        };
        UserRepresentation.prototype.friendlyName = function () {
            return this.get("friendlyName");
        };
        UserRepresentation.prototype.email = function () {
            return this.get("email");
        };
        UserRepresentation.prototype.roles = function () {
            return this.get("roles");
        };
        return UserRepresentation;
    })(ResourceRepresentation);
    Spiro.UserRepresentation = UserRepresentation;
    // matches the home page representation  5.0 
    var HomePageRepresentation = (function (_super) {
        __extends(HomePageRepresentation, _super);
        function HomePageRepresentation() {
            _super.call(this);
            this.hateoasUrl = Spiro.appPath;
        }
        // links 
        HomePageRepresentation.prototype.serviceLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/services");
        };
        HomePageRepresentation.prototype.userLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/user");
        };
        HomePageRepresentation.prototype.selfLink = function () {
            return this.links().linkByRel("self");
        };
        HomePageRepresentation.prototype.versionLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/version");
        };
        // custom 
        HomePageRepresentation.prototype.menusLink = function () {
            return this.links().linkByRel("urn:org.restfulobjects:rels/menus");
        };
        // linked representations 
        HomePageRepresentation.prototype.getSelf = function () {
            return this.selfLink().getTarget();
        };
        HomePageRepresentation.prototype.getUser = function () {
            return this.userLink().getTarget();
        };
        HomePageRepresentation.prototype.getDomainServices = function () {
            // cannot use getTarget here as that will just return a ListRepresentation 
            var domainServices = new DomainServicesRepresentation();
            this.serviceLink().copyToHateoasModel(domainServices);
            return domainServices;
        };
        HomePageRepresentation.prototype.getVersion = function () {
            return this.versionLink().getTarget();
        };
        //  custom 
        HomePageRepresentation.prototype.getMenus = function () {
            // cannot use getTarget here as that will just return a ListRepresentation 
            var menus = new MenusRepresentation();
            this.menusLink().copyToHateoasModel(menus);
            return menus;
        };
        return HomePageRepresentation;
    })(ResourceRepresentation);
    Spiro.HomePageRepresentation = HomePageRepresentation;
    // matches the Link representation 2.7
    var Link = (function (_super) {
        __extends(Link, _super);
        function Link(object) {
            _super.call(this, object);
            this.repTypeToModel = {
                "homepage": HomePageRepresentation,
                "user": UserRepresentation,
                "version": VersionRepresentation,
                "list": ListRepresentation,
                "object": DomainObjectRepresentation,
                "object-property": PropertyRepresentation,
                "object-collection": CollectionRepresentation,
                "object-action": ActionRepresentation,
                "action-result": ActionResultRepresentation,
                "error": ErrorRepresentation,
                "prompt": PromptRepresentation,
                // custom 
                "menu": MenuRepresentation
            };
        }
        Link.prototype.href = function () {
            return this.get("href");
        };
        Link.prototype.method = function () {
            return this.get("method");
        };
        Link.prototype.rel = function () {
            return new Rel(this.get("rel"));
        };
        Link.prototype.type = function () {
            return new MediaType(this.get("type"));
        };
        Link.prototype.title = function () {
            return this.get("title");
        };
        Link.prototype.arguments = function () {
            return this.get("arguments");
        };
        Link.prototype.extensions = function () {
            return this.get("extensions");
        };
        Link.prototype.copyToHateoasModel = function (hateoasModel) {
            hateoasModel.hateoasUrl = this.href();
            hateoasModel.method = this.method();
        };
        Link.prototype.getHateoasTarget = function (targetType) {
            var matchingType = this.repTypeToModel[targetType];
            var target = new matchingType({});
            return target;
        };
        // get the object that this link points to 
        Link.prototype.getTarget = function () {
            var target = this.getHateoasTarget(this.type().representationType);
            this.copyToHateoasModel(target);
            return target;
        };
        return Link;
    })(Spiro.ModelShim);
    Spiro.Link = Link;
})(Spiro || (Spiro = {}));
//# sourceMappingURL=spiro.models.js.map
//Copyright 2013-2014 Naked Objects Group Ltd
//Licensed under the Apache License, Version 2.0(the "License");
//you may not use this file except in compliance with the License.
//You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//Unless required by applicable law or agreed to in writing, software
//distributed under the License is distributed on an "AS IS" BASIS,
//WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//See the License for the specific language governing permissions and
//limitations under the License.
// helpers for common tasks with spiro model 
var Spiro;
(function (Spiro) {
    var Helpers;
    (function (Helpers) {
        function getClassName(obj) {
            var funcNameRegex = /function (.{1,})\(/;
            var results = (funcNameRegex).exec(obj.constructor.toString());
            return (results && results.length > 1) ? results[1] : "";
        }
        Helpers.getClassName = getClassName;
        function typeFromUrl(url) {
            var typeRegex = /(objects|services)\/([\w|\.]+)/;
            var results = (typeRegex).exec(url);
            return (results && results.length > 2) ? results[2] : "";
        }
        Helpers.typeFromUrl = typeFromUrl;
    })(Helpers = Spiro.Helpers || (Spiro.Helpers = {}));
})(Spiro || (Spiro = {}));
//# sourceMappingURL=spiro.models.helpers.js.map
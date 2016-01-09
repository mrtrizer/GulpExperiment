import Obj from "./core/obj.js"
import ObjTree from "./core/obj_tree.js"

console.log("DVIGLO ENGINE v0.1.0");

///Loads an object tree from json
///@param objTreeSrc JSON object
///@param classList List of using classes
export function loadTree(objTreeSrc, classList) {
	if (typeof(document) !== "object")
		throw Error("DOM is not loaded. Call loadTree() in main().");
	return new ObjTree(objTreeSrc, classList);
}

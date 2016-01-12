import Template from "template.js";
import Leaf from "leaf.js"

///@addtogroup Core
///@{

export default class Obj {
	
	constructor (tree,objSrc,parent) {
		this.tree = tree;
		this.parent_ = parent;
		this.objects_ = [];
		this.parseObject(objSrc);
	}
	
	///Serialize object
	toJSON() {
		var jsonData = { leafs:[], objects:[]};
		if (typeof(this.id) === "string")
			jsonData.id = this.id;
		for (let leaf of this.leafs_)
			jsonData.leafs.push(leaf.toJSON());
		for (let object of this.objects_)
			jsonData.objects.push(object.toJSON());
		return jsonData;
	}
	
	///[Experimental] Searches objects among all children
	children(leafClass = "*", id = "*") {
		return this.tree.findChildren(this,leafClass,id);
	}
	
	///[Experimental] Returns parent
	parent(leafClass = "*", id = "*") {
		return this.tree.findParent(this,leafClass,id);
	}
	
	///[Experimental] Returns direct children of the object 
	objects(leafClass = "*", id = "*") {
		throw new Error("Not implementd");
	}
	
	///[Experimental] Returns first appropriate leaf
	leaf(leafClass = "*") {
		var leafs = this.leafs(leafClass);
		return leafs.length > 0? leafs[0] : undefined;
	}
	
	///[Experimental] Returns liafs from object
	leafs(leafClass = "*") {
		if (typeof(this.tree.classList[leafClass]) !== "function") {
			console.log("WARNING: Leaf class", leafClass, "is not defined");
			return [];
		}
		return this.findLeafsInObj(leaf => {
			return leaf instanceof this.tree.classList[leafClass]
		})
	}
	
	///Searches leaf in object using func for checking
	findLeafsInObj(func) {
		var list = [];
		for (let leaf of this.leafs_)
			if (func(leaf))
				list.push(leaf);
		return list;
	}	
	
	///Send event to all listeners
	///@see ObjTree.emit()
	emit(listeners,event) {
		return this.tree.emit(listeners,event);
	}
	
	///Adds new leaf to the object
	addLeaf(leaf) {
		leaf.object = this;
		this.leafs_.push(leaf);
	}
	
	///Adds an object as child
	addChild(obj) {
		obj.parent_ = this;
		this.objects_.push(obj);
	}
	
	///Method creates Obj elements and adds leafs
	///@param src JSON source of object tree
	parseObject(src) {
		this.leafs_ = [];
		this.id = src.id || null;
		for (let leafSrc of src.leafs) {
			try {
				if (typeof(this.tree.classList[leafSrc.lclass]) !== "function")
					throw new Error("Invalid leaf class: " + leafSrc.lclass + ".");
				this.addLeaf(Leaf.createLeaf(this,leafSrc));
			} catch (e) {
				console.log("Leaf parsing error: ", e);
			}
		}
		if (typeof(src.objects) === "object")
			for (let curObjectSrc of src.objects)
				this.addChild(new Obj(this.tree, curObjectSrc, this));
	}
}

///@} Core

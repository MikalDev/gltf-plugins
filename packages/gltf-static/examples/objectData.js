const C3 = globalThis.C3
  , glMatrix = globalThis.glMatrix
  , vec3 = glMatrix.vec3
  , quat = glMatrix.quat
  , mat4 = glMatrix.mat4;
globalThis.ObjectData = class {
    #t = null;
    #i = null;
    #e = null;
    #r = null;
    #n = null;
    #a = null;
    #l = null;
    #s = null;
    #o = null;
    #h = null;
    #d = null;
    #u = null;
    #c = null;
    #m = null;
    constructor(t) {
        this.#t = t,
        this.#h = mat4.create(),
        this.#d = mat4.create()
    }
    Release() {
        this.#t = null,
        this.#h = null,
        this.#d = null,
        this.#i = null,
        this.#e = null,
        this.#r = null,
        this.#s = null,
        this.#o = null
    }
    GetModel3dObject() {
        return this.#t
    }
    GetName() {
        return this.#t.GetName()
    }
    GetId() {
        return this.#t.GetId()
    }
    GetParentId() {
        return this.#t.GetParentId()
    }
    SetParent(t) {
        this.#s = t
    }
    GetParent() {
        return this.#s
    }
    AddChild(t) {
        if (this.#o || (this.#o = []),
        !t)
            throw new Error("undefined model 3d hierarchy element");
        this.#o.push(t)
    }
    SetPosition(t) {
        C3.vec3FromArray(this.GetPosition(), t)
    }
    GetPosition() {
        return this.#i || (this.#i = vec3.fromValues(...this.#t.GetPosition()),
        this.#n = vec3.fromValues(...this.#t.GetPosition())),
        this.#i
    }
    GetQuaternion() {
        return this.#e || (this.#e = quat.fromValues(...this.#t.GetQuaternion()),
        this.#a = quat.fromValues(...this.#t.GetQuaternion())),
        this.#e
    }
    SetQuaternion(t) {
        C3.quatFromArray(this.GetQuaternion(), t)
    }
    GetScale() {
        return this.#r || (this.#r = vec3.fromValues(...this.#t.GetScale()),
        this.#l = vec3.fromValues(...this.#t.GetScale())),
        this.#r
    }
    SetScale(t) {
        C3.vec3FromArray(this.GetScale(), t)
    }
    ResetTransform() {
        this.#n && this.SetPosition(this.#n),
        this.#a && this.SetQuaternion(this.#a),
        this.#l && this.SetScale(this.#l)
    }
    SetTransform(t, i) {
        switch (t) {
        case "position":
            this.SetPosition(i);
            break;
        case "quaternion":
            this.SetQuaternion(i);
            break;
        case "scale":
            this.SetScale(i);
            break;
        default:
            throw new Error("unexpected transform")
        }
    }
    GetBindMatrix() {
        return this.#t.GetBindMatrix() && (this.#u || (this.#u = mat4.fromValues(...this.#t.GetBindMatrix()))),
        this.#u
    }
    GetBindMatrixInverse() {
        return this.#t.GetBindMatrixInverse() && (this.#c || (this.#c = mat4.fromValues(...this.#t.GetBindMatrixInverse()))),
        this.#c
    }
    GetRoot() {
        let t = this.GetParent();
        if (!t)
            return this;
        for (; t; ) {
            if (!t.GetParent())
                return t;
            t = t.GetParent()
        }
        return t
    }
    GetWorldMatrix() {
        return this.#d
    }
    UpdateWorldMatrix(t=!1, i=!1) {
        if (i = !!i,
        (t = !!t) && this.#s && this.#s.UpdateWorldMatrix(!0, !1),
        mat4.fromRotationTranslationScale(this.#h, this.GetQuaternion(), this.GetPosition(), this.GetScale()),
        this.#s ? mat4.multiply(this.#d, this.#s.GetWorldMatrix(), this.#h) : mat4.copy(this.#d, this.#h),
        i && this.#o)
            for (const t of this.#o)
                t.UpdateWorldMatrix(!1, !0)
    }
}
;

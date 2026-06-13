const C3 = globalThis.C3
  , glMatrix = globalThis.glMatrix
  , vec3 = glMatrix.vec3
  , mat4 = glMatrix.mat4;
globalThis.AnimatedModel = class {
    #t = null;
    #e = new Map;
    #s = new Map;
    #i = null;
    #n = null;
    #a = "";
    #r = !0;
    #o = null;
    #h = null;
    #l = null;
    #u = null;
    #m = {
        showBoundingBox: !1,
        boundingBoxColor: !1,
        useOwnNormalizationMatrix: null,
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        quaternion: null,
        scaleX: 0,
        scaleY: 0,
        scaleZ: 0,
        updateVertexData: !1,
        runtime: null
    };
    #c = {
        backFaceCulling: !1,
        origin: [],
        refreshOrigin: !0,
        loop: !0,
        onAnimationFinished: null,
        onAnimationLooped: null
    };
    #M = null;
    #d = null;
    #p = null;
    #f = null;
    #A = null;
    #x = null;
    #g = null;
    #D = null;
    constructor(t, e, s, i) {
        this.#t = e,
        this.#s = t.GetAnimationsMap();
        const n = new Map
          , a = [];
        for (const [e,s] of t.GetMeshesMap().entries()) {
            const t = new globalThis.AnimatedMeshData(s,n);
            n.set(t.GetId(), t),
            a.push(t)
        }
        for (const [e,s] of t.GetObjectsMap().entries()) {
            const t = new globalThis.ObjectData(s);
            n.set(t.GetId(), t)
        }
        const r = t => {
            for (const e of a) {
                if (!e.GetBoneData())
                    continue;
                const s = e.GetBoneData().find(e => e.GetId() === t);
                if (s)
                    return s
            }
        }
        ;
        for (const [e,s] of t.GetBonesMap().entries()) {
            const t = r(s.GetId());
            if (t)
                n.set(t.GetId(), t);
            else {
                const t = new globalThis.ObjectData(s);
                n.set(t.GetId(), t)
            }
        }
        for (const [s,i] of t.GetMeshesMap().entries()) {
            const t = n.get(i.GetId())
              , s = new globalThis.AnimatedMesh(t,e,this);
            this.#e.set(s.GetName(), s)
        }
        this.#D = n;
        for (const [t,e] of n.entries()) {
            if (!e.GetParentId())
                continue;
            const t = n.get(e.GetParentId());
            t && (e.SetParent(t),
            t.AddChild(e))
        }
        for (const [t,e] of n.entries())
            e.GetParent() || e.UpdateWorldMatrix(!1, !0);
        for (const t of this.#e.values())
            t.OnCreate();
        if (this.#s.size > 0)
            if (i) {
                for (const [t,e] of this.#s.entries())
                    t === i && (this.#n = e,
                    this.#a = t);
                if (!this.#n) {
                    const [t,e] = this.#s.entries().next().value;
                    this.#n = e,
                    this.#a = t
                }
            } else {
                const [t,e] = this.#s.entries().next().value;
                this.#n = e,
                this.#a = t
            }
        this.SetMeshes(s),
        this.#M = [],
        this.#d = [],
        this.#p = [],
        this.#f = [],
        this.#u = (t, e) => {
            const s = t.globalIndex
              , i = e.globalIndex;
            return this.#M[i].minCamDist - this.#M[s].minCamDist
        }
    }
    Release() {
        for (const t of this.#e.values())
            t.Release();
        this.#e.clear(),
        this.#s = null,
        C3.clearArray(this.#M),
        this.#M = null,
        C3.clearArray(this.#A),
        this.#A = null,
        C3.clearArray(this.#x),
        this.#x = null,
        C3.clearArray(this.#i),
        this.#i = null,
        this.#g = null,
        this.#n = null,
        this.#a = "",
        this.#o = null,
        this.#h = null,
        this.#l = null,
        this.#m = null,
        this.#t = null
    }
    GetAllObjectsDataMap() {
        return this.#D
    }
    GetTime() {
        if (this.#i)
            return this.#i[0] ? this.#i[0].GetTime() : 0;
        for (const t of this.#e.values())
            return t.GetTime()
    }
    GetTimeCurrentAnimation() {
        for (const t of this.#e.values())
            if (this.GetCurrentAnimation() === t.GetCurrentAnimation())
                return t.GetTime();
        return 0
    }
    Play(t, e, s) {
        if (!this.#r && !s) {
            if (!t)
                return;
            if (this.#a === t)
                return
        }
        if (this.#r = !1,
        this.#s.size && this.#s.get(t))
            this.#n = this.#s.get(t),
            this.#a = t;
        else if (this.#s.size) {
            const [t,e] = this.#s.entries().next().value;
            this.#n = e,
            this.#a = t
        } else
            this.#n = null,
            this.#a = "";
        for (const t of this.#e.values())
            t.ResetTransform();
        for (const i of this.#e.values())
            i.Play(t, e, s)
    }
    SetOptions(t) {
        this.#c.backFaceCulling = t.backFaceCulling,
        this.#c.loop = t.loop,
        this.#c.origin[0] = this.#w(t.origin, 0),
        this.#c.origin[1] = this.#w(t.origin, 1),
        this.#c.origin[2] = this.#w(t.origin, 2),
        this.#c.refreshOrigin = t.origin[3],
        this.#c.onAnimationFinished = t.animationFinishedCallback,
        this.#c.onAnimationLooped = t.animationLoopedCallback
    }
    #w(t, e) {
        const s = t[e];
        switch (e) {
        case 0:
            switch (s) {
            case 0:
            case "left":
                return -.5;
            case 1:
            case "middle":
                return 0;
            case 2:
            case "right":
                return .5
            }
        case 1:
            switch (s) {
            case 0:
            case "top":
                return -.5;
            case 1:
            case "middle":
                return 0;
            case 2:
            case "bottom":
                return .5
            }
        case 2:
            switch (s) {
            case 0:
            case "back":
                return .5;
            case 1:
            case "middle":
                return 0;
            case 2:
            case "front":
                return -.5
            }
        }
    }
    GetOptions() {
        return this.#c
    }
    Update(t, e, s, i, n, a, r, o, h, l, u, m, c, M) {
        if (t) {
            t.ResetCullState();
            const e = this.#t.GetBlendMode();
            "string" == typeof e ? t.SetNamedBlendMode(e) : t.SetBlendMode(e)
        }
        e.runtimeMode || (e.runtimeMode = "@all");
        const d = [...this.#e.values()];
        for (const e of d)
            e.MaybeCreateMeshData(t);
        if (this.#m.runtime = e.runtime,
        !this.#i || "isolate" !== s && 1 !== s) {
            if ("update" === e.runtimeMode || "@all" === e.runtimeMode)
                if (this.#m.showBoundingBox = !1,
                this.#m.boundingBoxColor = n,
                this.#m.useOwnNormalizationMatrix = !1,
                this.#m.positionX = a,
                this.#m.positionY = r,
                this.#m.positionZ = o,
                this.#m.quaternion = h,
                this.#m.scaleX = l,
                this.#m.scaleY = u,
                this.#m.scaleZ = m,
                this.#m.updateVertexData = !0,
                this.#m.runtime = e.runtime,
                this.#i) {
                    for (let t = 0; t < this.#i.length; t++)
                        this.#G(this.#i[t], e, c, M, t === this.#i.length - 1);
                    for (const t of d)
                        this.#i[0] && t.SetTime(this.#i[0].GetTime())
                } else
                    for (let t = 0; t < d.length; t++)
                        this.#G(d[t], e, c, M, t === d.length - 1);
            if (t && ("draw" === e.runtimeMode || "@all" === e.runtimeMode))
                if (1 === this.#e.size || this.#i)
                    this.#m.showBoundingBox = i,
                    this.#m.updateVertexData = !0,
                    this.#i ? this.#O(this.#i, t) : this.#O(d, t);
                else {
                    let s = 0
                      , a = 0
                      , r = 0
                      , o = 0;
                    const [h,l,u] = this.#t.GetLayer().GetCameraPosition(e.layoutView);
                    this.#m.updateVertexData = !0;
                    for (const t of d) {
                        t.UpdateVertexData(this.#m);
                        const e = t.GetBoundingBoxMid(t.GetTransformedVertexData());
                        if (this.#M[s]) {
                            const i = this.#M[s];
                            i.animatedMesh = t,
                            i.minCamDist = this.#C(h, l, u, e[0], e[1], e[2]),
                            s++
                        } else {
                            switch (this.#M[s] = {
                                animatedMesh: t,
                                minCamDist: this.#C(h, l, u, e[0], e[1], e[2])
                            },
                            t.GetRenderType()) {
                            case "opaque":
                                this.#d[a] = {
                                    animatedMesh: t,
                                    globalIndex: s
                                },
                                a++;
                                break;
                            case "cutout":
                                this.#p[r] = {
                                    animatedMesh: t,
                                    globalIndex: s
                                },
                                r++;
                                break;
                            case "transparent":
                                this.#f[o] = {
                                    animatedMesh: t,
                                    globalIndex: s
                                },
                                o++
                            }
                            s++
                        }
                    }
                    this.#f.sort(this.#u),
                    this.#m.updateVertexData = !1;
                    for (const e of this.#d)
                        e.animatedMesh.DrawMesh(t, this.#m);
                    for (const e of this.#p)
                        e.animatedMesh.DrawMesh(t, this.#m);
                    for (const e of this.#f)
                        e.animatedMesh.DrawMesh(t, this.#m);
                    this.#A || (this.#A = []),
                    C3.clearArray(this.#A);
                    for (const t of this.#M)
                        this.#A.push(t.animatedMesh.GetTransformedVertexData());
                    if (i) {
                        if (this.#A.length) {
                            t.SetCurrentZ(0),
                            t.SetColorFillMode(),
                            t.SetTexture(null),
                            t.SetColor(n);
                            for (const e of this.#M[0].animatedMesh.GetBoundingBoxForDrawing(this.#A))
                                t.Line3D(e[0][0], e[0][1], e[0][2], e[1][0], e[1][1], e[1][2]);
                            this.#T(this.#M[0].animatedMesh, this.#A, !1)
                        }
                    } else
                        this.#T(this.#M[0].animatedMesh, this.#A, !0)
                }
        } else {
            if ("update" === e.runtimeMode || "@all" === e.runtimeMode) {
                this.#m.showBoundingBox = i,
                this.#m.boundingBoxColor = n,
                this.#m.useOwnNormalizationMatrix = !0,
                this.#m.positionX = a,
                this.#m.positionY = r,
                this.#m.positionZ = o,
                this.#m.quaternion = h,
                this.#m.scaleX = l,
                this.#m.scaleY = u,
                this.#m.scaleZ = m,
                this.#m.updateVertexData = !0,
                this.#m.runtime = e.runtime;
                for (let t = 0; t < this.#i.length; t++)
                    this.#G(this.#i[t], e, c, M, t === this.#i.length - 1)
            }
            !t || "draw" !== e.runtimeMode && "@all" !== e.runtimeMode || this.#O(this.#i, t);
            for (const t of d)
                this.#i[0] && t.SetTime(this.#i[0].GetTime())
        }
    }
    IsUsingEffects() {
        const t = this.#t.GetProject && this.#t.GetProject().IsPreviewEffectsEnabled() && this.#t.HasAnyEffects()
          , e = this.#t.HasAnyActiveEffect && this.#t.HasAnyActiveEffect();
        return t || e
    }
    #O(t, e) {
        let s;
        this.#x || (this.#x = []),
        C3.clearArray(this.#x);
        for (const i of t)
            i.DrawMesh(e, this.#m),
            this.#x.push(i.GetTransformedVertexData()),
            s || (s = i);
        this.#T(s, this.#x, !0)
    }
    #T(t, e, s=!0) {
        t && (this.#g || (this.#g = new C3.AABB3D),
        s && t.GetBoundingBoxForDrawing(e),
        this.#g.set(...t.GetBoundingBoxMinMax()),
        this.#t.OverwriteBoundingBox(this.#g))
    }
    #G(t, e, s, i, n) {
        if (this.#t.IsContinuousRendering)
            if (this.#t.IsContinuousRendering())
                if (i)
                    t.SetAnimationAtTime(s);
                else if (n) {
                    const s = this.GetTimeCurrentAnimation()
                      , i = e.dt;
                    let n = !1;
                    const a = this.#s.get(this.GetCurrentAnimationName());
                    a && (n = s + i >= a.GetDuration()),
                    t.UpdateAnimation(i),
                    n && (this.#c.loop || (this.#t.SetPropertyValue("live-preview", !1),
                    t.SetAnimationAtTime(a.GetDuration())))
                } else
                    t.UpdateAnimation(e.dt);
            else
                t.SetAnimationAtTime(s);
        else if (e.animationPlaying)
            if (i)
                t.SetAnimationAtTime(s);
            else if (n) {
                const s = this.GetTimeCurrentAnimation()
                  , i = e.dt
                  , n = e.runtime;
                let a = !1;
                const r = this.#s.get(this.GetCurrentAnimationName());
                if (r && (a = s + i >= r.GetDuration()),
                t.UpdateAnimation(i),
                a && n)
                    if (this.#c.loop)
                        n.Trigger(C3.Plugins.Model3D.Cnds.OnAnyAnimationLooped, this.#t.GetInstance()),
                        n.Trigger(C3.Plugins.Model3D.Cnds.OnAnimationLooped, this.#t.GetInstance()),
                        "function" == typeof this.#c.onAnimationLooped && this.#c.onAnimationLooped(this.GetCurrentAnimationName());
                    else {
                        for (const t of this.#e.values())
                            t.SetAnimationAtTime(r.GetDuration());
                        this.#t.GetInstance().GetSdkInstance()._SetAnimation(this.GetCurrentAnimationName(), !1, 1, !0),
                        n.Trigger(C3.Plugins.Model3D.Cnds.OnAnimationFinished, this.#t.GetInstance()),
                        n.Trigger(C3.Plugins.Model3D.Cnds.OnAnyAnimationFinished, this.#t.GetInstance()),
                        "function" == typeof this.#c.onAnimationFinished && this.#c.onAnimationFinished(this.GetCurrentAnimationName())
                    }
            } else
                t.UpdateAnimation(e.dt);
        else
            t.SetAnimationAtTime(s)
    }
    SetMesh(t) {
        const e = this.#e.get(t);
        this.#i = e ? [e] : null,
        this.Play(this.#a)
    }
    SetAllMeshes() {
        this.#i = null,
        this.Play(this.#a)
    }
    SetNoMeshes() {
        this.SetMeshes([])
    }
    SetMeshes(t) {
        if (t) {
            if (this.#i || (this.#i = []),
            this.#i.length = 0,
            t instanceof globalThis.Map)
                if (t.size)
                    for (let[e,s] of t.entries())
                        e && (e = e.trim()),
                        this.#e.has(e) && s && this.#i.push(this.#e.get(e));
                else
                    this.#i = null;
            else if (globalThis.Array.isArray(t))
                for (let e of t)
                    e && (e = e.trim()),
                    this.#e.has(e) && this.#i.push(this.#e.get(e));
            else if ("string" == typeof t)
                for (let e of [t])
                    e && (e = e.trim()),
                    this.#e.has(e) && this.#i.push(this.#e.get(e));
            this.#i && this.#i.length === this.#e.size && (this.#i = null),
            this.Play(this.#a)
        } else
            this.SetAllMeshes()
    }
    GetCurrentMesh() {
        return this.#i && 0 !== this.#i.length ? this.#i.length > 1 ? null : this.#i[0] ? this.#i[0] : null : null
    }
    GetCurrentMeshes() {
        return this.#i
    }
    GetCurrentMeshesAsMap() {
        const t = new Map;
        for (const e of this.animatedMeshes())
            t.set(e.GetName(), !1);
        if (this.#i)
            for (const e of this.#i)
                t.set(e.GetName(), !0);
        return t
    }
    GetCurrentMeshName() {
        const t = this.GetCurrentMesh();
        return t ? t.GetName() : ""
    }
    GetCurrentMeshNames() {
        return this.#i ? this.#i.map(t => t.GetName()).join(",") : ""
    }
    GetCurrentAnimation() {
        return this.#n
    }
    GetCurrentAnimationName() {
        return this.#a
    }
    *currentMeshes() {
        if (this.#i)
            for (const t of this.#i)
                yield t.GetName();
        else
            for (const t of this.animatedMeshes())
                yield t.GetName()
    }
    *meshes() {
        for (const t of this.#e.keys())
            yield t
    }
    *animatedMeshes() {
        for (const t of this.#e.values())
            yield t
    }
    *animations() {
        if (this.#s)
            for (const t of this.#s.keys())
                yield t
    }
    *animationObjects() {
        if (this.#s)
            for (const t of this.#s.values())
                yield t
    }
    GetNormalizationMatrix() {
        return this.#B(),
        this.#o
    }
    GetPivotMatrix() {
        return this.#B(),
        this.#h
    }
    GetNormalizationAspect() {
        return this.#B(),
        this.#l
    }
    #B() {
        if (!this.#o) {
            let t = 1 / 0
              , e = -1 / 0
              , s = 1 / 0
              , i = -1 / 0
              , n = 1 / 0
              , a = -1 / 0;
            for (const r of this.#e.values()) {
                let o;
                o = r.IsSkinned() ? r.GetSkinnedVertexData() : r.GetWorldVertexData();
                for (let r = 0; r < o.length; r += 3) {
                    const h = o[r]
                      , l = o[r + 1]
                      , u = o[r + 2];
                    h < t && (t = h),
                    l < s && (s = l),
                    u < n && (n = u),
                    h > e && (e = h),
                    l > i && (i = l),
                    u > a && (a = u)
                }
            }
            const r = e - t
              , o = i - s
              , h = a - n
              , l = Math.max(r, o, h)
              , u = 1 / l
              , m = (t + e) / 2
              , c = (s + i) / 2
              , M = (n + a) / 2
              , d = mat4.create();
            mat4.fromScaling(d, [u, u, u]);
            const p = mat4.create();
            mat4.fromTranslation(p, [-m, -c, -M]);
            const f = mat4.create();
            mat4.multiply(f, d, p),
            this.#o = f,
            this.#l = {
                x: r / l,
                y: o / l,
                z: h / l
            }
        }
        if ((this.#c.refreshOrigin || !this.#h) && this.#l) {
            const t = Math.max(this.#l.x, this.#l.y, this.#l.z);
            this.#h || (this.#h = mat4.create());
            const e = this.#c.origin[0]
              , s = this.#c.origin[1]
              , i = this.#c.origin[2];
            C3.makeTranslateMatrix(mat4, this.#h, t * e, t * s, t * i)
        }
    }
    #C(t, e, s, i, n, a) {
        const r = i - t
          , o = n - e
          , h = a - s;
        return r * r + o * o + h * h
    }
}
;

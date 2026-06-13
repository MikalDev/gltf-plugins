const C3 = globalThis.C3
  , glMatrix = globalThis.glMatrix
  , vec3 = glMatrix.vec3
  , quat = glMatrix.quat
  , mat4 = glMatrix.mat4
  , VALID_COLOR_MODES = ["texture", "buffer", "instance"]
  , MAX_COLOR_VALUE = new Map([[globalThis.Int8Array, 127], [globalThis.Uint8Array, 255], [globalThis.Uint8ClampedArray, 255], [globalThis.Int16Array, 32767], [globalThis.Uint16Array, 65535], ...void 0 !== globalThis.Float16Array ? [[globalThis.Float16Array, 1]] : [], [globalThis.Int32Array, 2147483647], [globalThis.Uint32Array, 4294967295], [globalThis.Float32Array, 1], [globalThis.BigInt64Array, 9223372036854775807n], [globalThis.BigUint64Array, 18446744073709551615n], [globalThis.Float64Array, 1]]);
globalThis.AnimatedMesh = class {
    #t = null;
    #e = new Map;
    #i = new Map;
    #a = null;
    #s = null;
    #n = null;
    #r = "";
    #o = 0;
    #h = null;
    #l = null;
    #u = null;
    #m = null;
    #d = null;
    #c = null;
    #x = "texture";
    #M = null;
    #D = null;
    #g = new Set;
    #N = null;
    #f = null;
    #A = null;
    #p = null;
    #T = vec3.create();
    #b = vec3.create();
    #G = vec3.create();
    #C = quat.create();
    #B = quat.create();
    #w = quat.create();
    #S = null;
    #V = null;
    #k = [[NaN, NaN, NaN], [NaN, NaN, NaN], [NaN, NaN, NaN], [NaN, NaN, NaN], [NaN, NaN, NaN], [NaN, NaN, NaN], [NaN, NaN, NaN], [NaN, NaN, NaN]];
    #I = [NaN, NaN, NaN, NaN, NaN, NaN];
    #v = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    #y = [[NaN, NaN], [NaN, NaN], [NaN, NaN], [NaN, NaN], [NaN, NaN], [NaN, NaN], [NaN, NaN], [NaN, NaN], [NaN, NaN], [NaN, NaN], [NaN, NaN], [NaN, NaN]];
    #P = [NaN, NaN, NaN];
    #z = mat4.create();
    #R = mat4.create();
    #U = mat4.create();
    #O = mat4.create();
    #F = mat4.create();
    #q = vec3.create();
    #E = null;
    #Q = mat4.create();
    #W = quat.create();
    #L = quat.create();
    #j = vec3.fromValues(0, 0, 1);
    #Z = new C3.Color(0,0,0,1);
    #_ = new C3.Color(0,0,0,1);
    #X = !1;
    #H = !1;
    #Y = !0;
    #J = null;
    constructor(t, e, i) {
        this.#t = t,
        this.#a = e,
        this.#s = i,
        this.#n = null,
        this.#r = "",
        this.#o = 0,
        this.#h = this.#t.GetVertexData(),
        this.#M = new this.#h.constructor(this.#h.length),
        this.#l = this.#t.GetSkinIndexData(),
        this.#u = this.#t.GetSkinWeigthData(),
        this.#m = this.#t.GetBoneData(),
        this.#c = this.#t.GetBoneInverseMatricesData(),
        this.#d = this.#t.GetBoneBindPoseData(),
        this.#e = this.#t.GetAnimationsMap(),
        this.#m && (this.#E = new Array(this.#m.length)),
        this.#p = this.#t.GetModel3dTexture()
    }
    Release() {
        this.#X || (this.#X = !0,
        this.#t && this.#t.Release(),
        this.#t = null,
        this.#J && this.#J.Release(),
        this.#J = null,
        this.#a = null,
        this.#e = null,
        this.#n = null,
        this.#r = null,
        this.#h = null,
        this.#N = null,
        this.#f = null,
        this.#A = null,
        this.#g = null,
        this.#l = null,
        this.#u = null,
        this.#c = null,
        this.#d = null,
        this.#m = null,
        this.#M = null,
        this.#D = null,
        this.#p = null,
        this.#T = null,
        this.#b = null,
        this.#G = null,
        this.#C = null,
        this.#B = null,
        this.#w = null,
        this.#k = null,
        this.#v = null,
        this.#y = null,
        this.#z = null,
        this.#R = null,
        this.#U = null,
        this.#O = null,
        this.#q = null,
        this.#Q = null,
        this.#W = null,
        this.#L = null,
        this.#j = null)
    }
    OnCreate() {
        if (this.#t.IsSkinned()) {
            if (this.#e) {
                if (!this.#m)
                    return;
                for (const [t,e] of this.#e.entries())
                    this.#i.set(t, []),
                    e.GetTracks().forEach(e => {
                        const [i,a] = e.GetName().split(".");
                        let s = this.#m.find(t => t.GetName() === i)
                          , n = e.GetLookupUUID();
                        s || (s = this.#m.find(t => t.GetId() === n)),
                        (s || (s = this.#s.GetAllObjectsDataMap().get(n),
                        s)) && this.#i.get(t).push({
                            object3d: s,
                            transform: a,
                            track: e
                        })
                    }
                    )
            }
        } else if (this.#e)
            for (const [t,e] of this.#e.entries()) {
                this.#i.set(t, []);
                const i = new Set;
                e.GetTracks().forEach(e => {
                    const [a,s] = e.GetName().split(".");
                    if (a === this.#t.GetName())
                        this.#i.get(t).push({
                            object3d: this.#t,
                            transform: s,
                            track: e
                        });
                    else {
                        const a = this.#s.GetAllObjectsDataMap().get(e.GetLookupUUID());
                        if (a) {
                            if (i.has(a))
                                return;
                            i.add(a),
                            this.#i.get(t).push({
                                object3d: a,
                                transform: s,
                                track: e
                            })
                        }
                    }
                }
                )
            }
    }
    WasReleased() {
        return this.#X
    }
    GetName() {
        return this.#t.GetName()
    }
    GetInstance() {
        return this.#a
    }
    *animations() {
        if (this.#e)
            for (const t of this.#e.values())
                yield t
    }
    GetCurrentAnimation() {
        return this.#n || (this.#n = this.#e?.get(this.#r)),
        this.#n
    }
    GetCurrentAnimationName() {
        return this.#r
    }
    GetModel3dTexture() {
        return this.#p
    }
    GetRenderType() {
        return this.#t.GetRenderType()
    }
    SetTime(t) {
        this.#o = t
    }
    GetTime() {
        return this.#o
    }
    Play(t, e=0, i=!1) {
        t ? (this.#r !== t || i) && (this.#e ? (this.#n = this.#e.get(t),
        this.#r = t,
        this.#n ? (e < 0 && (e = 0),
        e > this.#n.GetDuration() && (e = this.#n.GetDuration()),
        this.#o = e) : this.#o = e,
        this.SetAnimationAtTime(this.#o, !0)) : this.SetAnimationAtTime(0, !0)) : this.SetAnimationAtTime(0, !0)
    }
    ResetTransform() {
        if (this.#m)
            return;
        const t = this.#s.GetAllObjectsDataMap();
        if (t)
            for (const e of t.values())
                e.ResetTransform();
        this.#t.ResetTransform()
    }
    SetAnimationAtTime(t, e=!1, i=!0) {
        (t !== this.#o || e) && (this.#m && this.#m.forEach( (t, e) => {
            t.SetPosition(this.#d[e].GetPosition()),
            t.SetQuaternion(this.#d[e].GetQuaternion()),
            t.SetScale(this.#d[e].GetScale())
        }
        ),
        this.UpdateAnimation(0, t, !!e, !!i))
    }
    UpdateAnimation(t, e=void 0, i=!1, a=!0) {
        this.#n || (this.#n = this.#e?.get(this.#r));
        const s = this.#o;
        if (C3.IsFiniteNumber(e) ? this.#n ? this.#o = e : this.#o = 0 : this.#n ? this.#o = (this.#o + t) % this.#n.GetDuration() : this.#o = 0,
        s !== this.#o || i)
            if (this.#t.IsSkinned()) {
                const t = this.#i.get(this.#r);
                if (t)
                    for (const e of t) {
                        const t = e.object3d
                          , i = e.transform
                          , a = e.track
                          , s = this.#K(a, this.#o, i);
                        t.SetTransform(i, s)
                    }
                if (this.#m.forEach(t => t.UpdateWorldMatrix(!0, !0)),
                a) {
                    const t = this.#t.GetBindMatrix()
                      , e = this.#t.GetBindMatrixInverse();
                    for (let i = 0; i < this.#m.length; i++) {
                        const a = this.#m[i].GetWorldMatrix()
                          , s = this.#c[i];
                        C3.mat4FromArray(this.#F, s);
                        const n = mat4.create();
                        t && e ? mat4.multiply(n, e, a) : mat4.copy(n, a),
                        mat4.multiply(n, n, this.#F),
                        this.#E[i] = n
                    }
                    const i = this.#h.length / 3;
                    for (let t = 0; t < i; t++) {
                        C3.vec3FromArray(this.#T, this.#h, 3 * t),
                        vec3.set(this.#b, 0, 0, 0);
                        const e = 4 * t;
                        for (let t = 0; t < 4; t++) {
                            const i = this.#u[e + t];
                            if (0 === i)
                                continue;
                            const a = this.#l[e + t]
                              , s = this.#E[a];
                            vec3.transformMat4(this.#G, this.#T, s),
                            vec3.scaleAndAdd(this.#b, this.#b, this.#G, i)
                        }
                        C3.vec3ToArray(this.#b, this.#M, 3 * t)
                    }
                }
            } else {
                const t = this.#i.get(this.#r);
                if (t)
                    for (const e of t) {
                        const t = e.object3d
                          , i = e.transform
                          , a = e.track
                          , s = this.#K(a, this.#o, i);
                        t.SetTransform(i, s)
                    }
                this.#t.UpdateWorldMatrix(!0, !0),
                this.#M = this.#h
            }
    }
    DrawMesh(t, e) {
        e.sdkInstance = this.#a.GetSdkInstance ? this.#a.GetSdkInstance() : null;
        const i = this.#p.GetTexture(e?.runtime, t, e);
        if (e?.updateVertexData && this.UpdateVertexData(e),
        t.SetCullFaceMode(this.#s.GetOptions().backFaceCulling ? 1 : 0),
        i && "texture" === this.#p.GetContentType() ? (this.#s.IsUsingEffects() || t.SetTextureFillMode(),
        t.SetTexture(i, this.#a.GetActiveSampling() ?? 0),
        this.#$(this.#a.GetColor ? this.#a.GetColor() : this.#a.GetUnpremultipliedColor()),
        t.DrawMeshData(this.#J)) : this.#t.GetColorData() ? (t.SetColorFillMode(),
        t.SetTexture(null),
        t.ResetColor(),
        this.#$(this.#a.GetColor ? this.#a.GetColor() : this.#a.GetUnpremultipliedColor()),
        t.DrawMeshData(this.#J)) : !this.#p.GetColor() || this.#p.HadTextureError(e) || this.#p.IsLoadingTexture(e) ? this.#p.HadTextureError(e) ? (t.SetColorFillMode(),
        t.SetTexture(null),
        t.SetColorRgba(.25, 0, 0, .25),
        t.DrawMeshData(this.#J)) : (t.SetColorFillMode(),
        t.SetTexture(null),
        t.SetColorRgba(0, 0, .1, .1),
        t.DrawMeshData(this.#J)) : (t.SetColorFillMode(),
        t.SetTexture(null),
        this.#tt(),
        t.DrawMeshData(this.#J)),
        e.showBoundingBox) {
            t.SetCurrentZ(0),
            t.SetColorFillMode(),
            t.SetTexture(null),
            t.SetColor(e.boundingBoxColor);
            for (const e of this.GetBoundingBoxForDrawing(this.#J.positions))
                t.Line3D(e[0][0], e[0][1], e[0][2], e[1][0], e[1][1], e[1][2])
        }
    }
    MaybeCreateMeshData(t) {
        if (this.#J)
            return;
        const e = this.#t.GetIndexData()
          , i = e ? e.length : this.#h.length / 3;
        this.#J = t.CreateMeshData(this.#h.length / 3, i, {
            staticPositions: !1,
            staticTexCoords: !1,
            staticColors: !1,
            staticIndices: !0
        }),
        this.#J.CreateGPUResources();
        const a = this.#t.GetUVData();
        if (a) {
            for (let t = 0; t < a.length; t++)
                this.#J.texCoords[t] = a[t];
            this.#J.MarkTexCoordsDataChanged()
        }
        if (e)
            for (let t = 0; t < e.length; t++)
                this.#J.indices[t] = e[t];
        else
            for (let t = 0; t < this.#J.indices.length; t++)
                this.#J.indices[t] = t;
        this.#J.MarkIndexDataChanged()
    }
    #tt() {
        const t = this.#p.GetColor();
        this.#_.equals(t) && "texture" === this.#x || (this.#_.set(t),
        this.#x = "texture",
        this.#J.FillColor(t.r, t.g, t.b, t.a),
        this.#J.MarkColorsDataChanged())
    }
    #$(t) {
        if (this.#t.GetColorData()) {
            if (this.#_.equals(t) && "buffer" === this.#x)
                return;
            this.#_.set(t),
            this.#x = "buffer";
            const e = this.#t.GetColorData()
              , i = MAX_COLOR_VALUE.get(e.constructor)
              , a = this.#J.colors;
            for (let s = 0; s < e.length; s += 4)
                a[s + 0] = e[s + 0] / i * t.r,
                a[s + 1] = e[s + 1] / i * t.g,
                a[s + 2] = e[s + 2] / i * t.b,
                a[s + 3] = e[s + 3] / i * t.a;
            this.#J.MarkColorsDataChanged()
        } else {
            if (this.#_.equals(t) && "instance" === this.#x)
                return;
            this.#_.set(t),
            this.#x = "instance",
            this.#J.FillColor(t.r, t.g, t.b, t.a),
            this.#J.MarkColorsDataChanged()
        }
    }
    UpdateVertexData(t) {
        let e, i, a;
        t?.useOwnNormalizationMatrix ? (e = this.#et(),
        i = this.#it(),
        a = this.#at()) : (e = this.#s.GetNormalizationMatrix(),
        i = this.#s.GetPivotMatrix(),
        a = this.#s.GetNormalizationAspect());
        const s = this.#a.GetWidth()
          , n = this.#a.GetHeight()
          , r = this.#a.GetX() + (t?.positionX ?? 0)
          , o = this.#a.GetY() + (t?.positionY ?? 0)
          , h = this.#a.GetTotalZ() + (t?.positionZ ?? 0)
          , l = Math.min(s / a.x, n / a.y)
          , u = t?.scaleX ?? 1
          , m = t?.scaleY ?? 1
          , d = t?.scaleZ ?? 1;
        this.#a.SetDepth(Math.abs(l * d)),
        C3.makeScaleMatrix(mat4, this.#z, l * u, l * m, l * d),
        C3.makeTranslateMatrix(mat4, this.#U, r, o, h),
        t.quaternion && (quat.setAxisAngle(this.#L, this.#j, this.#a.GetAngle()),
        quat.multiply(this.#W, this.#L, t.quaternion),
        mat4.fromQuat(this.#R, this.#W)),
        mat4.copy(this.#O, this.#U),
        mat4.multiply(this.#O, this.#O, this.#z),
        mat4.multiply(this.#O, this.#O, i),
        mat4.multiply(this.#O, this.#O, this.#R),
        mat4.multiply(this.#O, this.#O, e),
        this.#t.IsSkinned() || mat4.multiply(this.#O, this.#O, this.#t.GetWorldMatrix());
        const c = this.#t.IsSkinned() ? this.#M : this.#h
          , x = c.length / 3;
        for (let t = 0; t < x; t++)
            C3.vec3FromArray(this.#q, c, 3 * t),
            vec3.transformMat4(this.#q, this.#q, this.#O),
            C3.vec3ToArray(this.#q, this.#J.positions, 3 * t);
        this.#J.MarkPositionDataChanged()
    }
    GetRawVertexData() {
        return this.#h
    }
    GetSkinnedVertexData() {
        return this.#M
    }
    GetWorldVertexData() {
        if (this.#N && this.#D)
            return this.#D;
        this.#D || (this.#D = new this.#h.constructor(this.#h.length));
        const t = vec3.create();
        for (let e = 0; e < this.#h.length; e += 3)
            vec3.set(t, this.#h[e], this.#h[e + 1], this.#h[e + 2]),
            vec3.transformMat4(t, t, this.#t.GetWorldMatrix()),
            C3.vec3ToArray(t, this.#D, e);
        return this.#D
    }
    GetTransformedVertexData() {
        return this.#J.positions
    }
    IsSkinned() {
        return this.#t.IsSkinned()
    }
    InvalidateUV() {
        this.#Y = !0
    }
    GetUVData() {
        if (this.#Y) {
            if (!this.#p.IsContentReady())
                return this.#J.texCoords;
            const t = this.#p.GetSpriteSheetWidth()
              , e = this.#p.GetSpriteSheetHeight();
            if (!C3.IsFiniteNumber(t) || !C3.IsFiniteNumber(e))
                return this.#J.texCoords;
            this.#Y = !1;
            const i = this.#J.texCoords
              , a = this.#p.GetSpriteSheetOffsetX()
              , s = this.#p.GetSpriteSheetOffsetY()
              , n = this.#p.GetWidthInSpriteSheet()
              , r = this.#p.GetHeightInSpriteSheet();
            for (let o = 0; o < i.length; o += 2) {
                const h = i[o + 0]
                  , l = i[o + 1];
                i[o + 0] = a / t + h * (n / t),
                i[o + 1] = s / e + l * (r / e)
            }
            return this.#J.MarkTexCoordsDataChanged(),
            i
        }
        return this.#J.texCoords
    }
    GetIndexData() {
        return this.#J.indices
    }
    GetColorData() {
        return this.#J.colors
    }
    GetBoundingBoxMid(t) {
        let e = 1 / 0
          , i = 1 / 0
          , a = 1 / 0
          , s = -1 / 0
          , n = -1 / 0
          , r = -1 / 0
          , o = t.length;
        for (let h = 0; h < o; h += 3) {
            const o = t[h]
              , l = t[h + 1]
              , u = t[h + 2];
            o < e && (e = o),
            o > s && (s = o),
            l < i && (i = l),
            l > n && (n = l),
            u < a && (a = u),
            u > r && (r = u)
        }
        return this.#P[0] = (e + s) / 2,
        this.#P[1] = (i + n) / 2,
        this.#P[2] = (a + r) / 2,
        this.#P
    }
    GetBoundingBoxMinMax() {
        return this.#I
    }
    GetBoundingBoxForDrawing(t) {
        let e = 1 / 0
          , i = 1 / 0
          , a = 1 / 0
          , s = -1 / 0
          , n = -1 / 0
          , r = -1 / 0;
        if (Array.isArray(t[0]) || ArrayBuffer.isView(t[0]))
            for (let o = 0; o < t.length; o++) {
                const h = t[o];
                for (let t = 0; t < h.length; t += 3) {
                    const o = h[t]
                      , l = h[t + 1]
                      , u = h[t + 2];
                    o < e && (e = o),
                    o > s && (s = o),
                    l < i && (i = l),
                    l > n && (n = l),
                    u < a && (a = u),
                    u > r && (r = u)
                }
            }
        else
            for (let o = 0; o < t.length; o += 3) {
                const h = t[o]
                  , l = t[o + 1]
                  , u = t[o + 2];
                h < e && (e = h),
                h > s && (s = h),
                l < i && (i = l),
                l > n && (n = l),
                u < a && (a = u),
                u > r && (r = u)
            }
        this.#I[0] = e,
        this.#I[1] = i,
        this.#I[2] = a,
        this.#I[3] = s,
        this.#I[4] = n,
        this.#I[5] = r,
        this.#k[0][0] = e,
        this.#k[0][1] = i,
        this.#k[0][2] = a,
        this.#k[1][0] = s,
        this.#k[1][1] = i,
        this.#k[1][2] = a,
        this.#k[2][0] = s,
        this.#k[2][1] = n,
        this.#k[2][2] = a,
        this.#k[3][0] = e,
        this.#k[3][1] = n,
        this.#k[3][2] = a,
        this.#k[4][0] = e,
        this.#k[4][1] = i,
        this.#k[4][2] = r,
        this.#k[5][0] = s,
        this.#k[5][1] = i,
        this.#k[5][2] = r,
        this.#k[6][0] = s,
        this.#k[6][1] = n,
        this.#k[6][2] = r,
        this.#k[7][0] = e,
        this.#k[7][1] = n,
        this.#k[7][2] = r;
        for (let t = 0; t < this.#v.length; t++) {
            const e = this.#v[t];
            this.#y[t][0] = this.#k[e[0]],
            this.#y[t][1] = this.#k[e[1]]
        }
        return this.#y
    }
    #K(t, e, i) {
        const a = t.GetTimes()
          , s = t.GetValues()
          , n = t.GetInterpolation();
        let r = 0;
        for (; r < a.length - 1 && e > a[r + 1]; )
            r++;
        const o = r >= a.length - 1;
        let h;
        switch ("quaternion" === i ? (this.#V || (this.#V = quat.create()),
        h = this.#V) : (this.#S || (this.#S = vec3.create()),
        h = this.#S),
        n) {
        case t.constructor.STEP_INTERPOLATION:
            {
                const t = s.length / a.length
                  , e = (o ? a.length - 1 : r) * t;
                for (let i = 0; i < t; i++)
                    h[i] = s[e + i];
                return h
            }
        case t.constructor.CUBIC_SPLINE_INTERPOLATION:
            {
                const t = s.length / a.length
                  , i = t / 3
                  , n = o ? a.length - 1 : r
                  , l = Math.min(n + 1, a.length - 1)
                  , u = a[n]
                  , m = a[l] - u
                  , d = o ? 0 : (e - u) / m
                  , c = n * t
                  , x = l * t
                  , M = c + i
                  , D = c + 2 * i
                  , g = x
                  , N = x + i
                  , f = d * d
                  , A = f * d
                  , p = 2 * A - 3 * f + 1
                  , T = A - 2 * f + d
                  , b = -2 * A + 3 * f
                  , G = A - f;
                for (let t = 0; t < i; t++) {
                    const e = s[M + t]
                      , i = s[N + t]
                      , a = s[D + t]
                      , n = s[g + t];
                    h[t] = p * e + T * m * a + b * i + G * m * n
                }
                return 4 === i && quat.normalize(h, h),
                h
            }
        case t.constructor.LINEAR_INTERPOLATION:
        default:
            {
                const t = s.length / a.length
                  , i = o ? a.length - 1 : r
                  , n = Math.min(i + 1, a.length - 1)
                  , l = a[i]
                  , u = a[n]
                  , m = o ? 0 : (e - l) / (u - l)
                  , d = i * t
                  , c = n * t;
                if (4 !== t) {
                    for (let e = 0; e < t; e++) {
                        const t = s[d + e]
                          , i = s[c + e];
                        h[e] = t + (i - t) * m
                    }
                    return h
                }
                return C3.quatFromArray(this.#C, s, d),
                C3.quatFromArray(this.#B, s, c),
                quat.slerp(h, this.#C, this.#B, m),
                h
            }
        }
    }
    #et() {
        let t;
        if (this.#s.GetCurrentMeshes() ? (this.#g.has(this.#s.GetCurrentMeshes()) || (this.#g.clear(),
        this.#N = null),
        t = this.#s.GetCurrentMeshes(),
        this.#g.add(t)) : (this.#g.has(this) || (this.#g.clear(),
        this.#N = null),
        t = [this],
        this.#g.add(this)),
        !this.#N) {
            let e = 1 / 0
              , i = -1 / 0
              , a = 1 / 0
              , s = -1 / 0
              , n = 1 / 0
              , r = -1 / 0;
            for (const o of t) {
                let t;
                t = o.IsSkinned() ? o.GetSkinnedVertexData() : o.GetWorldVertexData();
                for (let o = 0; o < t.length; o += 3) {
                    const h = t[o]
                      , l = t[o + 1]
                      , u = t[o + 2];
                    h < e && (e = h),
                    l < a && (a = l),
                    u < n && (n = u),
                    h > i && (i = h),
                    l > s && (s = l),
                    u > r && (r = u)
                }
            }
            const o = (e + i) / 2
              , h = (a + s) / 2
              , l = (n + r) / 2
              , u = i - e
              , m = s - a
              , d = r - n
              , c = Math.max(u, m, d)
              , x = 1 / c
              , M = mat4.create();
            C3.makeScaleMatrix(mat4, M, x, x, x);
            const D = mat4.create();
            C3.makeTranslateMatrix(mat4, D, -o, -h, -l),
            this.#N = mat4.multiply(mat4.create(), M, D),
            this.#f = {
                x: u / c,
                y: m / c,
                z: d / c
            }
        }
        const e = this.#s.GetOptions();
        if ((e.refreshOrigin || !this.#A) && this.#f) {
            this.#A || (this.#A = mat4.create());
            const t = e.origin[0]
              , i = e.origin[1]
              , a = e.origin[2];
            C3.makeTranslateMatrix(mat4, this.#A, this.#f.x * t, this.#f.y * i, this.#f.z * a)
        }
        return this.#N
    }
    #at() {
        return this.#et(),
        this.#f
    }
    #it() {
        return this.#et(),
        this.#A
    }
}
;

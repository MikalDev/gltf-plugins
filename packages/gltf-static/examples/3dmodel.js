{
    const t = self.C3;
    t.Plugins.Model3D = class extends t.SDKPluginBase {
        constructor(t) {
            super(t)
        }
        Release() {
            super.Release()
        }
    }
}
{
    const t = self.C3;
    t.Plugins.Model3D.Type = class extends t.SDKTypeBase {
        #t;
        constructor(t) {
            super(t),
            this.#t = this.GetPlugin()?.GetExportData()?.[0] || []
        }
        Release() {
            super.Release()
        }
        OnCreate() {
            const t = this.GetRuntime().GetModel3dManager();
            for (const e of this.#t) {
                const i = t.GetModel3dDataItemByName(e);
                i.IsReady().then( () => {
                    for (const t of i.GetTextures())
                        t.LoadAsset(this.GetRuntime())
                }
                )
            }
        }
        LoadTextures(t) {
            const e = this.GetRuntime().GetModel3dManager()
              , i = [...this._objectClass.instancesIncludingPendingCreate()]
              , s = []
              , n = new Set;
            if (i.length)
                for (const e of i) {
                    const i = e.GetSdkInstance()._GetModel3dDataItem();
                    i && s.push(i.IsReady().then( () => {
                        for (const e of i.GetTextures())
                            n.has(e) || (e.GetTexture(this.GetRuntime(), t),
                            s.push(e.IsReady()),
                            n.add(e))
                    }
                    ))
                }
            else
                for (const i of this.#t) {
                    const a = e.GetModel3dDataItemByName(i);
                    s.push(a.IsReady().then( () => {
                        for (const e of a.GetTextures())
                            n.has(e) || (e.GetTexture(this.GetRuntime(), t),
                            s.push(e.IsReady()),
                            n.add(e))
                    }
                    ))
                }
            return Promise.all(s)
        }
        ReleaseTextures() {
            this._objectClass.GetRuntime();
            const t = new Set;
            for (const e of this.#e()) {
                const i = e.GetSdkInstance()._GetModel3dDataItem();
                if (i)
                    for (const e of i.GetTextures())
                        t.has(e) || (e.ReleaseTexture(),
                        t.add(e))
            }
        }
        ReleaseUnusedTextures() {
            const t = new Set;
            for (const e of this.#i()) {
                const i = e.GetSdkInstance()._GetModel3dDataItem();
                if (i)
                    for (const e of i.GetTextures())
                        e.HasTexture() && t.add(e)
            }
            const e = this._objectClass.GetRuntime().GetModel3dManager();
            for (const i of e.GetModel3dDataItems())
                for (const e of i.GetTextures())
                    t.has(e) || e.ReleaseTexture()
        }
        *#i() {
            const e = this._objectClass.GetRuntime();
            for (const i of e.GetAllObjectClasses())
                i.GetPlugin()instanceof t.Plugins.Model3D && (yield*i.instancesIncludingPendingCreate())
        }
        *#e() {
            yield*this._objectClass.instancesIncludingPendingCreate()
        }
    }
}
{
    const t = self.C3
      , e = self.C3X
      , i = globalThis.glMatrix
      , s = i.quat
      , n = i.vec3
      , a = 0
      , o = 1
      , r = 2
      , h = 3
      , l = 4
      , _ = 5
      , d = 6
      , u = 7
      , m = 8
      , c = 9
      , p = 10
      , g = 11
      , M = 12
      , G = 13
      , S = 14
      , b = 15
      , f = 16
      , R = 17
      , v = 18
      , A = 19
      , O = 20
      , y = 21
      , N = 22
      , q = 23
      , P = 0
      , k = 0
      , Z = 1
      , C = 2;
    t.Plugins.Model3D.Instance = class extends t.SDKWorldInstanceBase {
        constructor(e, i) {
            if (super(e),
            this._model3dName = "",
            this._positionX = 0,
            this._positionY = 0,
            this._positionZ = 0,
            this._rotationX = 0,
            this._rotationY = 0,
            this._rotationZ = 0,
            this._quaternion = s.create(),
            this._quaternionRet = null,
            this._tempRotation = null,
            this._scaleX = 1,
            this._scaleY = 1,
            this._scaleZ = 1,
            this._originX = Z,
            this._originY = Z,
            this._originZ = Z,
            this._meshNames = "",
            this._animationName = "",
            this._initiallyPlaying = !0,
            this._initialAnimationProgress = 0,
            this._boundingBox = !1,
            this._boundingBoxColor = null,
            this._meshRenderMode = P,
            this._animatedModelOptions = {
                backFaceCulling: !0,
                origin: [NaN, NaN, NaN, !0],
                loop: !0,
                animationFinishedCallback: null,
                animationLoopedCallback: null
            },
            i) {
                this._model3dName = i[a];
                const e = this._GetModel3dDataItem();
                this._positionX = i[r] + e?.GetOffset()[0] ?? 0,
                this._positionY = i[h] + e?.GetOffset()[1] ?? 0,
                this._positionZ = i[l] + e?.GetOffset()[2] ?? 0,
                this._rotationX = t.toRadians(i[_] + e?.GetRotation()[0] ?? 0),
                this._rotationY = t.toRadians(i[d] + e?.GetRotation()[1] ?? 0),
                this._rotationZ = t.toRadians(i[u] + e?.GetRotation()[2] ?? 0),
                s.fromEuler(this._quaternion, i[_] + e?.GetRotation()[0] ?? 0, i[d] + e?.GetRotation()[1] ?? 0, i[u] + e?.GetRotation()[2] ?? 0),
                this._scaleX = i[m] * e?.GetScale()[0] ?? 1,
                this._scaleY = i[c] * e?.GetScale()[1] ?? 1,
                this._scaleZ = i[p] * e?.GetScale()[2] ?? 1,
                this._originX = i[g],
                this._originY = i[M],
                this._originZ = i[G],
                this._meshNames = new Map(Object.entries(i[S])),
                this._animationName = i[v],
                this._initiallyPlaying = i[O],
                this._initialAnimationProgress = i[y],
                this._boundingBox = i[N],
                this._boundingBoxColor = i[q],
                this._meshRenderMode = i[b],
                this._animatedModelOptions.backFaceCulling = !!i[R],
                this._animatedModelOptions.loop = !!i[A]
            }
            this._animatedModel = null,
            this._drawParams = {
                dt: NaN,
                runtimeMode: "draw",
                animationPlaying: !1,
                runtime: null
            },
            this._isPlayingAnimation = !1,
            this._timelineTick = !1,
            this._model3dName && this._LoadFile(this._model3dName, this._meshNames, this._animationName, this._initiallyPlaying, this._initialAnimationProgress, !0);
            const n = this.GetWorldInfo();
            n.SetVisible(i?.[o] ?? !0),
            n.SetCollisionEnabled(i?.[f] ?? !0),
            n.SetOriginZ(.5),
            n.SetBboxChanged(),
            this._meshLoop = {
                indexes: [],
                depth: -1
            },
            this._animationLoop = {
                indexes: [],
                depth: -1
            }
        }
        Release() {
            this._animatedModel && (this._animatedModel.Release(),
            this._animatedModel = null),
            this._model3dName = "",
            t.clearArray(this._meshLoop.indexes),
            this._meshLoop.indexes = null,
            this._meshLoop = null,
            t.clearArray(this._animationLoop.indexes),
            this._animationLoop.indexes = null,
            this._animationLoop = null,
            this._drawParams = null,
            this._animatedModelOptions = null,
            super.Release()
        }
        GetOriginalSize() {
            return [200, 200, 200]
        }
        GetAnimatedModel() {
            return this._animatedModel
        }
        IsOriginalSizeKnown() {
            return !0
        }
        *animationObjects() {
            this._animatedModel && (yield*this._animatedModel.animationObjects())
        }
        _GetName() {
            return this._animatedModel ? this._model3dName : ""
        }
        _SetMesh(t=void 0) {
            this._animatedModel && this._animatedModel.SetMesh(t)
        }
        _GetMesh() {
            return this._animatedModel ? this._animatedModel.GetCurrentMeshName() : ""
        }
        _SetAllMeshes() {
            this._animatedModel && this._animatedModel.SetAllMeshes()
        }
        _SetNoMeshes() {
            this._animatedModel && this._animatedModel.SetNoMeshes()
        }
        _SetMeshes(t=void 0) {
            this._animatedModel && (t ? this._animatedModel.SetMeshes(t) : this._animatedModel.SetMeshes([]))
        }
        _GetMeshes() {
            return this._animatedModel ? this._animatedModel.GetCurrentMeshNames() : ""
        }
        _SetMeshEnabled(t, e) {
            if (!this._MeshExists(t))
                return void console.warn(`[3D Plugin]: ${t} is not a valid mesh`);
            const i = this._IsMeshDrawn(t);
            if (e) {
                if (this._IsDrawingAllMeshes())
                    return;
                if (i)
                    return;
                if (this._IsDrawingNoMeshes())
                    this._SetMeshes([t]);
                else if (this._IsDrawingSomeMeshes()) {
                    const e = [...this._GetCurrentMeshesNames()];
                    e.push(t),
                    this._SetMeshes(e)
                }
            } else {
                if (this._IsDrawingNoMeshes())
                    return;
                if (!i)
                    return;
                if (this._IsDrawingAllMeshes()) {
                    const e = [...this._GetCurrentMeshesNames()]
                      , i = e.indexOf(t);
                    e.splice(i, 1),
                    this._SetMeshes(e)
                } else if (this._IsDrawingSomeMeshes()) {
                    const e = [...this._GetCurrentMeshesNames()]
                      , i = e.indexOf(t);
                    e.splice(i, 1),
                    this._SetMeshes(e)
                }
            }
        }
        _GetMeshCount() {
            return this._animatedModel ? [...this._animatedModel.meshes()].length : 0
        }
        _GetMeshAt(t) {
            return this._animatedModel ? [...this._animatedModel.meshes()][t] ?? "" : ""
        }
        _IsDrawingAllMeshes() {
            return !this._GetCurrentMeshes() || this._GetCurrentMeshes().length === this._GetMeshCount()
        }
        _IsDrawingNoMeshes() {
            return this._GetCurrentMeshes() && 0 === this._GetCurrentMeshes().length
        }
        _IsDrawingSomeMeshes() {
            return this._GetCurrentMeshes() && this._GetCurrentMeshes().length > 0 && this._GetCurrentMeshes().length !== this._GetMeshCount()
        }
        _IsMeshDrawn(t) {
            if (this._IsDrawingAllMeshes())
                return !0;
            if (this._IsDrawingNoMeshes())
                return !1;
            for (const e of this._GetCurrentMeshesNames())
                if (t === e)
                    return !0;
            return !1
        }
        _MeshExists(t) {
            if (!this._animatedModel)
                return !1;
            for (const e of this._animatedModel.meshes())
                if (e === t)
                    return !0;
            return !1
        }
        _GetCurrentMeshes() {
            if (this._animatedModel)
                return this._animatedModel.GetCurrentMeshes()
        }
        *_GetCurrentMeshesNames() {
            this._animatedModel && (yield*this._animatedModel.currentMeshes())
        }
        _GetMeshRenderMode() {
            return 0 === this._meshRenderMode ? "hierarchy" : 1 === this._meshRenderMode ? "isolate" : void 0
        }
        _SetMeshRenderMode(t) {
            this._meshRenderMode = t
        }
        _SetBackfaceCulling(t) {
            switch (t) {
            case 0:
                this._animatedModelOptions.backFaceCulling = !1;
                break;
            case 1:
                this._animatedModelOptions.backFaceCulling = !0;
                break;
            case 2:
                this._animatedModelOptions.backFaceCulling = !this._animatedModelOptions.backFaceCulling
            }
        }
        _GetBackfaceCulling() {
            return !!this._animatedModelOptions.backFaceCulling
        }
        _SetAnimation(e=void 0, i=!1, s=0, n=!1) {
            if (this._animatedModel) {
                if (e = e || this._animatedModel.GetCurrentAnimationName()) {
                    const i = t.clamp(s || 0, 0, 1)
                      , a = this._GetAnimationByNameDuration(e)
                      , o = "number" == typeof a ? i * a : 0;
                    this._animatedModel.Play(e, o, n)
                } else
                    this._animatedModel.Play(e, 0, n);
                this._initialAnimationProgress = s,
                this._isPlayingAnimation = !!i
            }
        }
        _GetAnimation() {
            return this._animatedModel ? this._animatedModel.GetCurrentAnimationName() : ""
        }
        _GetAnimationsCount() {
            return this._animatedModel ? [...this._animatedModel.animations()].length : 0
        }
        _GetAnimationAt(t) {
            return this._animatedModel ? [...this._animatedModel.animations()][t] ?? "" : ""
        }
        _SetProgress(t=0) {
            this._initialAnimationProgress = t,
            this._animatedModel && this._SetAnimation(this._animatedModel.GetCurrentAnimationName(), this._isPlayingAnimation, this._initialAnimationProgress, !0)
        }
        _SetOrigin(t, e, i) {
            t !== k && t !== Z && t !== C || (this._originX = t),
            e !== k && e !== Z && e !== C || (this._originY = e),
            i !== k && i !== Z && i !== C || (this._originZ = i),
            this._runtime.UpdateRender()
        }
        _GetOriginName(t) {
            switch (t) {
            case "x":
                if (this._originX === k)
                    return "origin-x-left";
                if (this._originX === Z)
                    return "origin-x-middle";
                if (this._originX === C)
                    return "origin-x-right";
                break;
            case "y":
                if (this._originY === k)
                    return "origin-y-top";
                if (this._originY === Z)
                    return "origin-y-middle";
                if (this._originY === C)
                    return "origin-y-bottom";
                break;
            case "z":
                if (this._originZ === k)
                    return "origin-z-back";
                if (this._originZ === Z)
                    return "origin-z-middle";
                if (this._originZ === C)
                    return "origin-z-front"
            }
        }
        _GetOriginAsString(t, e) {
            switch (t) {
            case 0:
                switch (e) {
                case "x":
                    return "left";
                case "y":
                    return "top";
                case "z":
                    return "back"
                }
            case 1:
                switch (e) {
                case "x":
                case "y":
                case "z":
                    return "middle"
                }
            case 2:
                switch (e) {
                case "x":
                    return "right";
                case "y":
                    return "bottom";
                case "z":
                    return "front"
                }
            }
        }
        _SetPosition(t, e, i, s=0) {
            switch (s) {
            case 0:
                this._positionX = t,
                this._positionY = e,
                this._positionZ = i;
                break;
            case 1:
                this._positionX += t,
                this._positionY += e,
                this._positionZ += i;
                break;
            case 2:
                this._positionX -= t,
                this._positionY -= e,
                this._positionZ -= i;
                break;
            case 3:
                this._positionX *= t,
                this._positionY *= e,
                this._positionZ *= i;
                break;
            case 4:
                this._positionX /= t,
                this._positionY /= e,
                this._positionZ /= i
            }
            this._runtime.UpdateRender()
        }
        _SetRotation(e, i, n, a=0) {
            let o = e
              , r = i
              , h = n;
            switch (a) {
            case 0:
                this._rotationX = o,
                this._rotationY = r,
                this._rotationZ = h,
                s.fromEuler(this._quaternion, t.toDegrees(o), t.toDegrees(r), t.toDegrees(h));
                break;
            case 1:
                this._rotationX += o,
                this._rotationY += r,
                this._rotationZ += h,
                s.rotateX(this._quaternion, this._quaternion, o),
                s.rotateY(this._quaternion, this._quaternion, r),
                s.rotateZ(this._quaternion, this._quaternion, h),
                s.normalize(this._quaternion, this._quaternion);
                break;
            case 2:
                this._rotationX -= o,
                this._rotationY -= r,
                this._rotationZ -= h,
                s.rotateX(this._quaternion, this._quaternion, -o),
                s.rotateY(this._quaternion, this._quaternion, -r),
                s.rotateZ(this._quaternion, this._quaternion, -h),
                s.normalize(this._quaternion, this._quaternion);
                break;
            case 3:
                {
                    const t = this._rotationX * (o - 1)
                      , e = this._rotationY * (r - 1)
                      , i = this._rotationZ * (h - 1);
                    this._rotationX *= o,
                    this._rotationY *= r,
                    this._rotationZ *= h,
                    s.rotateX(this._quaternion, this._quaternion, t),
                    s.rotateY(this._quaternion, this._quaternion, e),
                    s.rotateZ(this._quaternion, this._quaternion, i),
                    s.normalize(this._quaternion, this._quaternion);
                    break
                }
            case 4:
                {
                    const t = this._rotationX * (1 / o - 1)
                      , e = this._rotationY * (1 / r - 1)
                      , i = this._rotationZ * (1 / h - 1);
                    this._rotationX /= o,
                    this._rotationY /= r,
                    this._rotationZ /= h,
                    s.rotateX(this._quaternion, this._quaternion, t),
                    s.rotateY(this._quaternion, this._quaternion, e),
                    s.rotateZ(this._quaternion, this._quaternion, i),
                    s.normalize(this._quaternion, this._quaternion);
                    break
                }
            }
            this._runtime.UpdateRender()
        }
        _SetScale(t, e, i, s=0) {
            switch (s) {
            case 0:
                this._scaleX = t,
                this._scaleY = e,
                this._scaleZ = i;
                break;
            case 1:
                this._scaleX += t,
                this._scaleY += e,
                this._scaleZ += i;
                break;
            case 2:
                this._scaleX -= t,
                this._scaleY -= e,
                this._scaleZ -= i;
                break;
            case 3:
                this._scaleX *= t,
                this._scaleY *= e,
                this._scaleZ *= i;
                break;
            case 4:
                this._scaleX /= t,
                this._scaleY /= e,
                this._scaleZ /= i
            }
            this._runtime.UpdateRender()
        }
        _Play(t=void 0, e=0) {
            this._SetAnimation(t, !0, e, !0)
        }
        _Stop() {
            if (!this._animatedModel)
                return;
            const t = this._animatedModel.GetCurrentAnimationName();
            this._SetAnimation(t, !1, 0, !0)
        }
        _Pause() {
            if (!this._animatedModel)
                return;
            const t = this._animatedModel.GetCurrentAnimationName()
              , e = this._GetAnimationByNameProgress(t);
            this._SetAnimation(t, !1, e, !0)
        }
        _Resume() {
            if (!this._animatedModel)
                return;
            const t = this._animatedModel.GetCurrentAnimationName()
              , e = this._GetAnimationByNameProgress(t);
            this._SetAnimation(t, !0, e, !0)
        }
        _GetModelFileName() {
            return this._model3dName
        }
        _GetAllMeshes() {
            return this._animatedModel ? [...this._animatedModel.meshes()] : []
        }
        _GetAllAnimations() {
            return this._animatedModel ? [...this._animatedModel.animations()] : []
        }
        _GetProgress() {
            const t = this._animatedModel?.GetCurrentAnimationName();
            return t ? this._GetAnimationByNameProgress(t) : 0
        }
        _GetAnimationDuration(t) {
            return this._GetAnimationByNameDuration(t)
        }
        _IsPlaying() {
            return this._isPlayingAnimation
        }
        _SetPlaying(t) {
            this._isPlayingAnimation = !!t
        }
        _IsLooping() {
            return this._animatedModelOptions.loop
        }
        _SetLooping(t) {
            switch (t) {
            case 0:
            case !1:
                this._animatedModelOptions.loop = !1;
                break;
            case 1:
            case !0:
                this._animatedModelOptions.loop = !0;
                break;
            case 2:
                this._animatedModelOptions.loop = !this._animatedModelOptions.loop
            }
        }
        _GetModel3dDataItem() {
            const t = this._runtime.GetModel3dManager();
            if (this._model3dName)
                return t.GetModel3dDataItemByName(this._model3dName)
        }
        async _LoadFile(e, i=void 0, s=void 0, n=!1, a=0, o=!1, r=null, h=null) {
            if (this._model3dName !== e || o) {
                this._animatedModel && (this._animatedModel.Release(),
                this._animatedModel = null);
                try {
                    this._model3dName = e;
                    const h = this._GetModel3dDataItem();
                    if (!h)
                        throw new Error("missing data item");
                    h.Resolved() || await h.IsReady(),
                    this._animatedModel = new globalThis.AnimatedModel(new globalThis.AnimatedModelData(h),this._inst.GetWorldInfo(),i,s),
                    i ? this._SetMeshes(i) : this._SetAllMeshes(),
                    this._SetAnimation(s, n, a, o),
                    this.IsTicking() || this._StartTicking();
                    const l = this.GetRuntime();
                    if (l && this._inst)
                        if (this._inst.GetSdkInstance())
                            l.Trigger(t.Plugins.Model3D.Cnds.OnLoadModel, this._inst),
                            r && r();
                        else {
                            const e = i => {
                                this._inst === i.instance && (l.Trigger(t.Plugins.Model3D.Cnds.OnLoadModel, this._inst),
                                r && r(),
                                l.Dispatcher().removeEventListener("instancecreate", e))
                            }
                            ;
                            l.Dispatcher().addEventListener("instancecreate", e)
                        }
                } catch (i) {
                    t.Plugins.Model3D.Exps.SetLastErrorModel3dName(e, this);
                    const s = this.GetRuntime();
                    if (s && this._inst)
                        if (this._inst.GetSdkInstance())
                            s.Trigger(t.Plugins.Model3D.Cnds.OnLoadModelFail, this._inst),
                            this._animatedModel && (this._animatedModel.Release(),
                            this._animatedModel = null),
                            h && h();
                        else {
                            const e = i => {
                                this._inst === i.instance && (s.Trigger(t.Plugins.Model3D.Cnds.OnLoadModelFail, this._inst),
                                this._animatedModel && (this._animatedModel.Release(),
                                this._animatedModel = null),
                                h && h(),
                                s.Dispatcher().removeEventListener("instancecreate", e))
                            }
                            ;
                            s.Dispatcher().addEventListener("instancecreate", e)
                        }
                }
            }
        }
        _GetAnimationByNameDuration(t) {
            for (const e of this.animationObjects())
                if (t === e.GetName())
                    return e.GetDuration();
            return 0
        }
        _GetAnimationByNameProgress(t) {
            if (!this._animatedModel)
                return 0;
            const e = this._GetAnimationByNameDuration(t);
            if (!e)
                return 0;
            return this._animatedModel.GetTime() / e
        }
        RendersToOwnZPlane() {
            return !1
        }
        Draw(t) {
            if (!this._animatedModel)
                return;
            this._drawParams.runtimeMode = "draw",
            this._drawParams.dt = NaN,
            this._drawParams.animationPlaying = !1,
            this._drawParams.runtime = this._runtime;
            const e = this._animatedModelOptions.origin;
            e[3] = e[0] !== this._originX || e[1] !== this._originY || e[2] !== this._originZ,
            e[0] = this._originX,
            e[1] = this._originY,
            e[2] = this._originZ,
            this._animatedModel.SetOptions(this._animatedModelOptions),
            this._animatedModel.Update(t, this._drawParams, this._meshRenderMode, !1, 0, this._positionX, this._positionY, this._positionZ, this._quaternion, this._scaleX, this._scaleY, this._scaleZ, 0, !1)
        }
        Tick() {
            if (!this._animatedModel)
                return;
            this._drawParams.runtimeMode = "update",
            this._drawParams.dt = this.GetRuntime().GetDt(this._inst),
            this._drawParams.animationPlaying = this._isPlayingAnimation,
            this._drawParams.runtime = this._runtime;
            const e = this._animatedModel.GetCurrentAnimationName()
              , i = t.clamp(this._initialAnimationProgress, 0, 1)
              , s = this._GetAnimationByNameDuration(e)
              , n = "number" == typeof s ? i * s : 0;
            this._animatedModel.SetOptions(this._animatedModelOptions),
            this._animatedModel.Update(this._runtime.GetRenderer(), this._drawParams, this._meshRenderMode, !1, 0, this._positionX, this._positionY, this._positionZ, this._quaternion, this._scaleX, this._scaleY, this._scaleZ, n, this._timelineTick),
            this._runtime.UpdateRender(),
            this._timelineTick = !1
        }
        MustPreDraw() {
            return !1
        }
        SaveToJson() {
            return {
                "m3d": this._model3dName,
                "px": this._positionX,
                "py": this._positionY,
                "pz": this._positionZ,
                "rx": this._rotationX,
                "ry": this._rotationY,
                "rz": this._rotationZ,
                "qx": this._quaternion[0],
                "qy": this._quaternion[1],
                "qz": this._quaternion[2],
                "qw": this._quaternion[3],
                "sx": this._scaleX,
                "sy": this._scaleY,
                "sz": this._scaleZ,
                "ox": this._originX,
                "oy": this._originY,
                "oz": this._originZ,
                "mns": this._GetMeshes(),
                "an": this._GetAnimation(),
                "iap": this._initialAnimationProgress,
                "cap": this._GetProgress(),
                "bb": this._boundingBox,
                "bbc": this._boundingBoxColor,
                "pa": this._IsPlaying(),
                "bfc": !!this._animatedModelOptions.backFaceCulling,
                "l": !!this._animatedModelOptions.loop
            }
        }
        LoadFromJson(e) {
            if (this._StopTicking(),
            this._model3dName = e["m3d"],
            this._positionX = e["px"],
            this._positionY = e["py"],
            this._positionZ = e["pz"],
            this._rotationX = e["rx"],
            this._rotationY = e["ry"],
            this._rotationZ = e["rz"],
            e.hasOwnproperty("qx") && e.hasOwnproperty("qy") && e.hasOwnproperty("qz") && e.hasOwnproperty("qw") ? s.set(this._quaternion, e["qx"], e["qy"], e["qz"], e["qw"]) : s.fromEuler(this._quaternion, t.toDegrees(this._rotationX), t.toDegrees(this._rotationY), t.toDegrees(this._rotationZ)),
            this._scaleX = e["sx"],
            this._scaleY = e["sy"],
            this._scaleZ = e["sz"],
            this._originX = e.hasOwnproperty("sx") ? e["ox"] : Z,
            this._originY = e.hasOwnproperty("sy") ? e["oy"] : Z,
            this._originZ = e.hasOwnproperty("sz") ? e["oz"] : Z,
            this._meshNames = null,
            e["mn"] && !e["mns"])
                this._meshNames = new Map,
                this._meshNames.set(e["mn"], !0);
            else if (e["mns"]) {
                this._meshNames = new Map;
                for (const t of e["mns"].split(","))
                    this._meshNames.set(t, !0)
            }
            this._animationName = e["an"],
            this._initialAnimationProgress = e["iap"],
            this._boundingBox = e["bb"],
            this._boundingBoxColor = e["bbc"],
            this._isPlayingAnimation = e["pa"],
            this._animatedModelOptions.backFaceCulling = !!e.hasOwnproperty("bfc") && e["bfc"],
            this._animatedModelOptions.loop = !e.hasOwnproperty("l") || e["l"],
            this._LoadFile(this._model3dName, this._meshNames, this._animationName, this._isPlayingAnimation, e["cap"], !0)
        }
        GetPropertyValueByIndex(t) {
            switch (t) {
            case r:
                return this._positionX;
            case h:
                return this._positionY;
            case l:
                return this._positionZ;
            case _:
                return this._rotationX;
            case d:
                return this._rotationY;
            case u:
                return this._rotationZ;
            case m:
                return this._scaleX;
            case c:
                return this._scaleY;
            case p:
                return this._scaleZ;
            case g:
                return this._originX;
            case M:
                return this._originY;
            case G:
                return this._originZ;
            case S:
                return this._animatedModel ? this._animatedModel.GetCurrentMeshesAsMap() : new Map;
            case v:
                return this._animationName;
            case y:
                return this._initialAnimationProgress;
            case f:
                return this.GetWorldInfo().IsCollisionEnabled();
            case b:
                return this._meshRenderMode;
            case R:
                return this._animatedModelOptions.backFaceCulling;
            case A:
                return this._animatedModelOptions.loop
            }
        }
        SetPropertyValueByIndex(e, i, n) {
            switch (e) {
            case r:
                n.relative ? this._positionX = i : n.absolute && (this._positionX = i + this._GetModel3dDataItem()?.GetOffset()[0] ?? 0);
                break;
            case h:
                n.relative ? this._positionY = i : n.absolute && (this._positionY = i + this._GetModel3dDataItem()?.GetOffset()[1] ?? 0);
                break;
            case l:
                n.relative ? this._positionZ = i : n.absolute && (this._positionZ = i + this._GetModel3dDataItem()?.GetOffset()[2] ?? 0);
                break;
            case _:
                n.relative ? this._rotationX = i : n.absolute && (this._rotationX = i + t.toRadians(this._GetModel3dDataItem()?.GetRotation()[0] ?? 0)),
                s.fromEuler(this._quaternion, t.toDegrees(this._rotationX), t.toDegrees(this._rotationY), t.toDegrees(this._rotationZ));
                break;
            case d:
                n.relative ? this._rotationY = i : n.absolute && (this._rotationY = i + t.toRadians(this._GetModel3dDataItem()?.GetRotation()[1] ?? 0)),
                s.fromEuler(this._quaternion, t.toDegrees(this._rotationX), t.toDegrees(this._rotationY), t.toDegrees(this._rotationZ));
                break;
            case u:
                n.relative ? this._rotationZ = i : n.absolute && (this._rotationZ = i + t.toRadians(this._GetModel3dDataItem()?.GetRotation()[2] ?? 0)),
                s.fromEuler(this._quaternion, t.toDegrees(this._rotationX), t.toDegrees(this._rotationY), t.toDegrees(this._rotationZ));
                break;
            case m:
                n.relative ? this._scaleX = i : n.absolute && (this._scaleX = i * this._GetModel3dDataItem()?.GetScale()[0] ?? 1);
                break;
            case c:
                n.relative ? this._scaleY = i : n.absolute && (this._scaleY = i * this._GetModel3dDataItem()?.GetScale()[1] ?? 1);
                break;
            case p:
                n.relative ? this._scaleZ = i : n.absolute && (this._scaleZ = i * this._GetModel3dDataItem()?.GetScale()[2] ?? 1);
                break;
            case g:
                this._originX = i;
                break;
            case M:
                this._originY = i;
                break;
            case G:
                this._originZ = i;
                break;
            case S:
                this._animatedModel && this._animatedModel.SetMeshes(i);
                break;
            case v:
                this._animationName = i,
                this._animatedModel && this._animatedModel.Play(this._animationName);
                break;
            case y:
                this._initialAnimationProgress = i,
                this._timelineTick = !0;
                break;
            case f:
                this.GetWorldInfo().SetCollisionEnabled(i);
                break;
            case b:
                this._meshRenderMode = i;
                break;
            case R:
                this._animatedModelOptions.backFaceCulling = i;
                break;
            case A:
                this._animatedModelOptions.loop = i
            }
        }
        _GetForIndex(t) {
            switch (t) {
            case "mesh":
                return this._meshLoop.depth >= 0 && this._meshLoop.depth < this._meshLoop.indexes.length ? this._meshLoop.indexes[this._meshLoop.depth] : 0;
            case "animation":
                return this._animationLoop.depth >= 0 && this._animationLoop.depth < this._animationLoop.indexes.length ? this._animationLoop.indexes[this._animationLoop.depth] : 0
            }
        }
        GetScriptInterfaceClass() {
            return self.I3DModelInstance
        }
        GetDebuggerProperties() {
            const e = "plugins.model3d";
            return [{
                title: e + ".name",
                properties: [{
                    name: e + ".properties.3d-model-object.name",
                    type: "list",
                    value: {
                        selected: this._GetModelFileName(),
                        options: Y(this._runtime)
                    },
                    onedit: t => this._LoadFile(t)
                }, {
                    name: e + ".properties.meshes.name",
                    type: "dropdown",
                    value: this._GetAllMeshes().map( (t, e) => ({
                        translate: !1,
                        id: e,
                        name: t,
                        value: !!this._IsMeshDrawn(t),
                        onedit: e => {
                            this._SetMeshEnabled(t, !!e)
                        }
                    }))
                }, {
                    name: e + ".properties.animation.name",
                    type: "list",
                    value: {
                        selected: this._GetAnimation(),
                        options: this._GetAllAnimations()
                    },
                    onedit: t => this._SetAnimation(t)
                }, {
                    name: e + ".properties.mesh-render-mode.name",
                    type: "list",
                    value: {
                        selected: {
                            label: e + ".debugger." + this._GetMeshRenderMode(),
                            value: this._meshRenderMode
                        },
                        options: [{
                            label: e + ".debugger.hierarchy",
                            value: 0
                        }, {
                            label: e + ".debugger.isolate",
                            value: 1
                        }]
                    },
                    onedit: t => {
                        this._SetMeshRenderMode(t)
                    }
                }, {
                    name: e + ".properties.loop.name",
                    value: this._IsLooping(),
                    onedit: t => this._SetLooping(!!t)
                }, {
                    name: e + ".properties.back-face-culling.name",
                    value: this._GetBackfaceCulling(),
                    onedit: t => this._SetBackfaceCulling(t ? 1 : 0)
                }, {
                    name: e + ".properties.x-position.name",
                    value: this._GetOffsetX(),
                    onedit: t => this._SetPosition(t, this._positionY, this._positionZ)
                }, {
                    name: e + ".properties.y-position.name",
                    value: this._GetOffsetY(),
                    onedit: t => this._SetPosition(this._positionX, t, this._positionZ)
                }, {
                    name: e + ".properties.z-position.name",
                    value: this._GetOffsetZ(),
                    onedit: t => this._SetPosition(this._positionX, this._positionY, t)
                }, {
                    name: e + ".properties.x-rotation.name",
                    value: t.toDegrees(this._GetRotationX()),
                    onedit: e => this._SetRotation(t.toRadians(e), this._rotationY, this._rotationZ)
                }, {
                    name: e + ".properties.y-rotation.name",
                    value: t.toDegrees(this._GetRotationY()),
                    onedit: e => this._SetRotation(this._rotationX, t.toRadians(e), this._rotationZ)
                }, {
                    name: e + ".properties.z-rotation.name",
                    value: t.toDegrees(this._GetRotationZ()),
                    onedit: e => this._SetRotation(this._rotationX, this._rotationY, t.toRadians(e))
                }, {
                    name: e + ".properties.x-scale.name",
                    value: this._GetScaleX(),
                    onedit: t => this._SetScale(t, this._scaleY, this._scaleZ)
                }, {
                    name: e + ".properties.y-scale.name",
                    value: this._GetScaleY(),
                    onedit: t => this._SetScale(this._scaleX, t, this._scaleZ)
                }, {
                    name: e + ".properties.z-scale.name",
                    value: this._GetScaleZ(),
                    onedit: t => this._SetScale(this._scaleX, this._scaleY, t)
                }, {
                    name: e + ".properties.x-origin.name",
                    type: "list",
                    value: {
                        selected: {
                            label: e + ".debugger." + this._GetOriginName("x"),
                            value: this._originX
                        },
                        options: [{
                            label: e + ".debugger.origin-top",
                            value: 0
                        }, {
                            label: e + ".debugger.origin-middle",
                            value: 1
                        }, {
                            label: e + ".debugger.origin-bottom",
                            value: 2
                        }]
                    },
                    onedit: t => {
                        this._SetOriginX(t)
                    }
                }, {
                    name: e + ".properties.y-origin.name",
                    type: "list",
                    value: {
                        selected: {
                            label: e + ".debugger." + this._GetOriginName("y"),
                            value: this._originY
                        },
                        options: [{
                            label: e + ".debugger.origin-top",
                            value: 0
                        }, {
                            label: e + ".debugger.origin-middle",
                            value: 1
                        }, {
                            label: e + ".debugger.origin-bottom",
                            value: 2
                        }]
                    },
                    onedit: t => {
                        this._SetOriginY(t)
                    }
                }, {
                    name: e + ".properties.z-origin.name",
                    type: "list",
                    value: {
                        selected: {
                            label: e + ".debugger." + this._GetOriginName("z"),
                            value: this._originZ
                        },
                        options: [{
                            label: e + ".debugger.origin-top",
                            value: 0
                        }, {
                            label: e + ".debugger.origin-middle",
                            value: 1
                        }, {
                            label: e + ".debugger.origin-bottom",
                            value: 2
                        }]
                    },
                    onedit: t => {
                        this._SetOriginZ(t)
                    }
                }, {
                    name: e + ".properties.enable-collisions.name",
                    value: this.GetWorldInfo().IsCollisionEnabled(),
                    onedit: t => this.GetWorldInfo().SetCollisionEnabled(t)
                }, {
                    name: e + ".debugger.playing",
                    value: this._IsPlaying()
                }, {
                    name: e + ".debugger.progress",
                    value: this._GetProgress(),
                    onedit: t => this._SetProgress(t)
                }, {
                    name: e + ".debugger.playback-controls",
                    type: "button-array",
                    value: [{
                        name: "▶",
                        translate: !1,
                        onaction: () => this._Play(this._GetAnimation(), 0)
                    }, {
                        name: "⏹",
                        translate: !1,
                        onaction: () => this._Stop()
                    }, {
                        name: "⏸",
                        translate: !1,
                        onaction: () => this._Pause()
                    }, {
                        name: "⏯",
                        translate: !1,
                        onaction: () => this._Resume()
                    }]
                }]
            }]
        }
        _SetOffsetX(t) {
            this._positionX = t,
            this._runtime.UpdateRender()
        }
        _GetOffsetX() {
            return this._positionX
        }
        _SetOffsetY(t) {
            this._positionY = t,
            this._runtime.UpdateRender()
        }
        _GetOffsetY() {
            return this._positionY
        }
        _SetOffsetZ(t) {
            this._positionZ = t,
            this._runtime.UpdateRender()
        }
        _GetOffsetZ() {
            return this._positionZ
        }
        _SetQuaternion(e, i, a, o) {
            s.set(this._quaternion, e, i, a, o),
            this._tempRotation || (this._tempRotation = n.create()),
            t.quatToEuler(this._tempRotation, e, i, a, o, "zyx"),
            this._rotationX = this._tempRotation[0],
            this._rotationY = this._tempRotation[1],
            this._rotationZ = this._tempRotation[2],
            this._runtime.UpdateRender()
        }
        _GetQuaternion() {
            return this._quaternionRet || (this._quaternionRet = []),
            this._quaternionRet[0] = this._quaternion[0],
            this._quaternionRet[1] = this._quaternion[1],
            this._quaternionRet[2] = this._quaternion[2],
            this._quaternionRet[3] = this._quaternion[3],
            this._quaternionRet
        }
        _SetRotationX(t) {
            const e = t - this._rotationX;
            s.rotateX(this._quaternion, this._quaternion, e),
            s.normalize(this._quaternion, this._quaternion),
            this._rotationX = t,
            this._runtime.UpdateRender()
        }
        _GetRotationX() {
            return this._rotationX
        }
        _SetRotationY(t) {
            const e = t - this._rotationY;
            s.rotateY(this._quaternion, this._quaternion, e),
            s.normalize(this._quaternion, this._quaternion),
            this._rotationY = t,
            this._runtime.UpdateRender()
        }
        _GetRotationY() {
            return this._rotationY
        }
        _SetRotationZ(t) {
            const e = t - this._rotationZ;
            s.rotateZ(this._quaternion, this._quaternion, e),
            s.normalize(this._quaternion, this._quaternion),
            this._rotationZ = t,
            this._runtime.UpdateRender()
        }
        _GetRotationZ() {
            return this._rotationZ
        }
        _SetScaleX(t) {
            this._scaleX = t,
            this._runtime.UpdateRender()
        }
        _GetScaleX() {
            return this._scaleX
        }
        _SetScaleY(t) {
            this._scaleY = t,
            this._runtime.UpdateRender()
        }
        _GetScaleY() {
            return this._scaleY
        }
        _SetScaleZ(t) {
            this._scaleZ = t,
            this._runtime.UpdateRender()
        }
        _GetScaleZ() {
            return this._scaleZ
        }
        _TransformOrigin(t, e) {
            switch (e) {
            case "x":
                switch (t) {
                case "left":
                    t = k;
                    break;
                case "middle":
                    t = Z;
                    break;
                case "right":
                    t = C
                }
            case "y":
                switch (t) {
                case "top":
                    t = k;
                    break;
                case "middle":
                    t = Z;
                    break;
                case "bottom":
                    t = C
                }
            case "z":
                switch (t) {
                case "back":
                    t = k;
                    break;
                case "middle":
                    t = Z;
                    break;
                case "front":
                    t = C
                }
            }
            return t !== k && t !== Z && t !== C ? NaN : t
        }
        _SetOriginX(t) {
            t = this._TransformOrigin(t, "x"),
            globalThis.isNaN(t) || (this._originX = t,
            this._runtime.UpdateRender())
        }
        _GetOriginX() {
            return this._originX
        }
        _SetOriginY(t) {
            t = this._TransformOrigin(t, "y"),
            globalThis.isNaN(t) || (this._originY = t,
            this._runtime.UpdateRender())
        }
        _GetOriginY() {
            return this._originY
        }
        _SetOriginZ(t) {
            t = this._TransformOrigin(t, "z"),
            globalThis.isNaN(t) || (this._originZ = t,
            this._runtime.UpdateRender())
        }
        _GetOriginZ() {
            return this._originZ
        }
        _GetAnimationFinishedCallback() {
            return this._animatedModelOptions.animationFinishedCallback
        }
        _SetAnimationFinishedCallback(t) {
            this._animatedModelOptions.animationFinishedCallback = t
        }
        _GetAnimationLoopedCallback() {
            return this._animatedModelOptions.animationLoopedCallback
        }
        _SetAnimationLoopedCallback(t) {
            this._animatedModelOptions.animationLoopedCallback = t
        }
    }
    ;
    let X = null;
    const Y = t => {
        if (X)
            return X;
        X = [];
        for (const e of t.GetModel3dManager().GetModel3dDataItems())
            X.push(e.GetName());
        return X
    }
      , I = ["hierarchy", "isolate"]
      , D = ["offset", "rotation", "scale"];
    self.I3DModelInstance = class extends self.IWorldInstance {
        #s;
        #n;
        constructor() {
            super(),
            this.#s = self.IInstance._GetInitInst().GetSdkInstance()
        }
        loadModel(t, i, s, n, a) {
            e.RequireString(t),
            this.#s._LoadFile(t, i, s, n, a, !1, () => {
                this.onLoad && this.onLoad()
            }
            , () => {
                this.onError && this.onError()
            }
            )
        }
        onLoad() {}
        onError() {}
        set onAnimationFinished(t) {
            this.#s._SetAnimationFinishedCallback(t)
        }
        get onAnimationFinished() {
            return this.#s._GetAnimationFinishedCallback()
        }
        set onAnimationLooped(t) {
            this.#s._SetAnimationLoopedCallback(t)
        }
        get onAnimationLooped() {
            return this.#s._GetAnimationLoopedCallback()
        }
        set meshRenderMode(t) {
            if (!I.includes(t))
                throw new Error(`invalid mesh render mode '${t}'"`);
            this.#s._SetMeshRenderMode(I.indexOf(t))
        }
        get meshRenderMode() {
            return this.#s._GetMeshRenderMode()
        }
        set backfaceCulling(t) {
            this.#s._SetBackfaceCulling(t ? 1 : 0)
        }
        get backfaceCulling() {
            return this.#s._GetBackfaceCulling()
        }
        set modelName(t) {
            this.loadModel(t)
        }
        get modelName() {
            return this.#s._GetName()
        }
        set meshName(t) {
            e.RequireOptionalString(t),
            this.#s._SetMesh(t)
        }
        get meshName() {
            return this.#s._GetMesh()
        }
        set meshNames(t) {
            e.RequireOptionalArray(t),
            this.#s._SetMeshes(t)
        }
        get meshNames() {
            const t = this.#s._GetMeshes();
            return t ? t.split(",") : []
        }
        set animationName(t) {
            e.RequireString(t),
            this.#s._SetAnimation(t, !1, 0)
        }
        get animationName() {
            return this.#s._GetAnimation()
        }
        set animationProgress(t) {
            e.RequireFiniteNumber(t),
            this.#s._SetProgress(t)
        }
        get animationProgress() {
            return this.#s._GetProgress()
        }
        setTransform(t, i, s, n) {
            switch (e.RequireFiniteNumber(t),
            e.RequireFiniteNumber(i),
            e.RequireFiniteNumber(s),
            e.RequireString(n),
            n) {
            case D[0]:
                this.#s._SetPosition(t, i, s, 0);
                break;
            case D[1]:
                this.#s._SetRotation(t, i, s, 0);
                break;
            case D[2]:
                this.#s._SetScale(t, i, s, 0);
                break;
            default:
                throw new Error(`invalid transform type '${n}')`)
            }
        }
        addTransform(t, i, s, n) {
            switch (e.RequireFiniteNumber(t),
            e.RequireFiniteNumber(i),
            e.RequireFiniteNumber(s),
            e.RequireString(n),
            n) {
            case D[0]:
                this.#s._SetPosition(t, i, s, 1);
                break;
            case D[1]:
                this.#s._SetRotation(t, i, s, 1);
                break;
            case D[2]:
                this.#s._SetScale(t, i, s, 1);
                break;
            default:
                console.warn(`invalid transform type "${n}", valid transform types are: "${D}"`)
            }
        }
        subTransform(t, i, s, n) {
            switch (e.RequireFiniteNumber(t),
            e.RequireFiniteNumber(i),
            e.RequireFiniteNumber(s),
            e.RequireString(n),
            n) {
            case D[0]:
                this.#s._SetPosition(t, i, s, 2);
                break;
            case D[1]:
                this.#s._SetRotation(t, i, s, 2);
                break;
            case D[2]:
                this.#s._SetScale(t, i, s, 2);
                break;
            default:
                console.warn(`invalid transform type "${n}", valid transform types are: "${D}"`)
            }
        }
        mulTransform(t, i, s, n) {
            switch (e.RequireFiniteNumber(t),
            e.RequireFiniteNumber(i),
            e.RequireFiniteNumber(s),
            e.RequireString(n),
            n) {
            case D[0]:
                this.#s._SetPosition(t, i, s, 3);
                break;
            case D[1]:
                this.#s._SetRotation(t, i, s, 3);
                break;
            case D[2]:
                this.#s._SetScale(t, i, s, 3);
                break;
            default:
                console.warn(`invalid transform type "${n}", valid transform types are: "${D}"`)
            }
        }
        divTransform(t, i, s, n) {
            switch (e.RequireFiniteNumber(t),
            e.RequireFiniteNumber(i),
            e.RequireFiniteNumber(s),
            e.RequireString(n),
            n) {
            case D[0]:
                this.#s._SetPosition(t, i, s, 4);
                break;
            case D[1]:
                this.#s._SetRotation(t, i, s, 4);
                break;
            case D[2]:
                this.#s._SetScale(t, i, s, 4);
                break;
            default:
                console.warn(`invalid transform type "${n}", valid transform types are: "${D}"`)
            }
        }
        setQuaternion(t, i, s, n) {
            e.RequireFiniteNumber(t),
            e.RequireFiniteNumber(i),
            e.RequireFiniteNumber(s),
            e.RequireFiniteNumber(n),
            this.#s._SetQuaternion(t, i, s, n)
        }
        getQuaternion() {
            this.#n || (this.#n = {
                x: 0,
                y: 0,
                z: 0,
                w: 1
            });
            const t = this.#s._GetQuaternion();
            return this.#n.x = t[0],
            this.#n.y = t[1],
            this.#n.z = t[2],
            this.#n.w = t[3],
            this.#n
        }
        set offsetX(t) {
            this.#s._SetOffsetX(t)
        }
        get offsetX() {
            return this.#s._GetOffsetX()
        }
        set offsetY(t) {
            this.#s._SetOffsetY(t)
        }
        get offsetY() {
            return this.#s._GetOffsetY()
        }
        set offsetZ(t) {
            this.#s._SetOffsetZ(t)
        }
        get offsetZ() {
            return this.#s._GetOffsetZ()
        }
        set rotationX(t) {
            this.#s._SetRotationX(t)
        }
        get rotationX() {
            return this.#s._GetRotationX()
        }
        set rotationY(t) {
            this.#s._SetRotationY(t)
        }
        get rotationY() {
            return this.#s._GetRotationY()
        }
        set rotationZ(t) {
            this.#s._SetRotationZ(t)
        }
        get rotationZ() {
            return this.#s._GetRotationZ()
        }
        set scaleX(t) {
            this.#s._SetScaleX(t)
        }
        get scaleX() {
            return this.#s._GetScaleX()
        }
        set scaleY(t) {
            this.#s._SetScaleY(t)
        }
        get scaleY() {
            return this.#s._GetScaleY()
        }
        set scaleZ(t) {
            this.#s._SetScaleZ(t)
        }
        get scaleZ() {
            return this.#s._GetScaleZ()
        }
        set originX(t) {
            this.#s._SetOriginX(t)
        }
        get originX() {
            return this.#s._GetOriginAsString(this.#s._GetOriginX(), "x")
        }
        set originY(t) {
            this.#s._SetOriginY(t)
        }
        get originY() {
            return this.#s._GetOriginAsString(this.#s._GetOriginY(), "y")
        }
        set originZ(t) {
            this.#s._SetOriginZ(t)
        }
        get originZ() {
            return this.#s._GetOriginAsString(this.#s._GetOriginZ(), "z")
        }
        set isPlaying(t) {
            const e = this.#s
              , i = e._GetAnimation()
              , s = e._GetProgress();
            e._SetAnimation(i, t, s, !0)
        }
        get isPlaying() {
            return this.#s._IsPlaying()
        }
        set isLooping(t) {
            this.#s._SetLooping(t)
        }
        get isLooping() {
            return this.#s._IsLooping()
        }
        getAllMeshes() {
            return this.#s._GetAllMeshes()
        }
        getAllAnimations() {
            return this.#s._GetAllAnimations()
        }
        isMeshEnabled(t) {
            return this.#s._IsMeshDrawn(t)
        }
        areAllMeshesEnabled() {
            return this.#s._IsDrawingAllMeshes()
        }
        meshExists(t) {
            return this.#s._MeshExists(t)
        }
        animationDuration(t) {
            return e.RequireString(t),
            this.#s._GetAnimationDuration(t)
        }
        setMeshEnabled(t, e) {
            this.#s._SetMeshEnabled(t, e)
        }
        setAllMeshesEnabled(t) {
            t ? this.#s._SetAllMeshes() : this.#s._SetNoMeshes()
        }
        play(t="", i=0) {
            e.RequireString(t),
            e.RequireFiniteNumber(i),
            this.#s._Play(t, i)
        }
        stop() {
            this.#s._Stop()
        }
        pause() {
            this.#s._Pause()
        }
        resume() {
            this.#s._Resume()
        }
    }
}
{
    const t = self.C3;
    t.Plugins.Model3D.Cnds = {
        OnLoadModel: () => !0,
        OnLoadModelFail: () => !0,
        ForEach(t, e) {
            if (!this.GetAnimatedModel())
                return !1;
            const i = this.GetRuntime()
              , s = i.GetEventSheetManager()
              , n = i.GetCurrentEvent()
              , a = n.GetSolModifiers()
              , o = i.GetEventStack()
              , r = o.GetCurrentStackFrame()
              , h = o.Push(n)
              , l = s.GetLoopStack()
              , _ = l.Push()
              , d = ++t.depth
              , u = t.indexes;
            d === t.indexes.length ? u.push(0) : u[d] = 0,
            i.SetDebuggingEnabled(!1);
            for (let t = 0; t < e; ++t) {
                u[d] = t,
                s.PushCopySol(a),
                _.SetIndex(t);
                this.GetObjectClass().GetCurrentSol().PickOne(this.GetInstance()),
                n.Retrigger(r, h),
                s.PopSol(a)
            }
            return i.SetDebuggingEnabled(!0),
            t.depth--,
            o.Pop(),
            l.Pop(),
            !1
        },
        ForEachMesh() {
            return t.Plugins.Model3D.Cnds.ForEach.call(this, this._meshLoop, this._GetAllMeshes().length)
        },
        ForEachAnimation() {
            return t.Plugins.Model3D.Cnds.ForEach.call(this, this._animationLoop, this._GetAllAnimations().length)
        },
        IsCollisionEnabled() {
            return this.GetWorldInfo().IsCollisionEnabled()
        },
        IsPlaying() {
            return this._IsPlaying()
        },
        IsLooping() {
            return this._IsLooping()
        },
        IsMeshEnabled(t) {
            return this._IsMeshDrawn(t)
        },
        AreAllMeshesEnabled() {
            return this._IsDrawingAllMeshes()
        },
        MeshExists(t) {
            return this._MeshExists(t)
        },
        MeshRenderMode(t) {
            let e = "";
            return 0 === t && (e = "hierarchy"),
            1 === t && (e = "isolate"),
            this._GetMeshRenderMode() === e
        },
        IsBackFaceCullingEnabled() {
            return !!this._GetBackfaceCulling()
        },
        OnAnimationFinished(t) {
            return this._GetAnimation() === t
        },
        OnAnimationLooped(t) {
            return this._GetAnimation() === t
        },
        OnAnyAnimationFinished: () => !0,
        OnAnyAnimationLooped: () => !0
    }
}
{
    const t = self.C3;
    t.Plugins.Model3D.Acts = {
        SetModel(t, e, i, s, n, a) {
            return this._SetLooping(n),
            e ? this._LoadFile(t, [e], i, s, a) : this._LoadFile(t, void 0, i, s, a).then( () => {
                this._SetAllMeshes()
            }
            )
        },
        SetModelByName(t, e, i, s, n, a) {
            return this._SetLooping(n),
            e ? this._LoadFile(t, [e], i, s, a) : this._LoadFile(t, void 0, i, s, a).then( () => {
                this._SetAllMeshes()
            }
            )
        },
        SetMeshEnabled(t, e) {
            this._SetMeshEnabled(t, e)
        },
        SetAllMeshesEnabled(t) {
            t ? this._SetAllMeshes() : this._SetNoMeshes()
        },
        SetMeshRenderMode(t) {
            this._SetMeshRenderMode(t)
        },
        SetAnimation(t, e, i, s) {
            this._SetLooping(i),
            this._SetAnimation(t, e, s, !0)
        },
        SetProgress(t) {
            this._SetProgress(t)
        },
        SetLooping(t) {
            this._SetLooping(t)
        },
        SetOrigin(t, e, i) {
            this._SetOrigin(t, e, i)
        },
        SetTransform(e, i, s, n, a) {
            switch (a) {
            case 0:
                this._SetPosition(e, i, s, n);
                break;
            case 1:
                this._SetRotation(t.toRadians(e), t.toRadians(i), t.toRadians(s), n);
                break;
            case 2:
                this._SetScale(e, i, s, n)
            }
        },
        SetQuaternion(t, e, i, s) {
            this._SetQuaternion(t, e, i, s)
        },
        Play(t, e, i) {
            this._SetLooping(e),
            this._Play(t, i)
        },
        Stop() {
            this._Stop()
        },
        Pause() {
            this._Pause()
        },
        Resume() {
            this._Resume()
        },
        SetCollisions(t) {
            this.GetWorldInfo().SetCollisionEnabled(t)
        },
        SetBackfaceCulling(t) {
            this._SetBackfaceCulling(t)
        },
        SetMesh(t) {
            this._SetMesh(t)
        },
        SetMeshes(t, e, i) {
            if ((t = t.split(i)).includes("@all"))
                e ? this._SetMesh("@all") : this._SetMeshes([]);
            else if (t.length)
                for (const i of t)
                    this._SetMeshEnabled(i, e)
        }
    }
}
{
    const t = self.C3
      , e = new Map;
    t.Plugins.Model3D.Exps = {
        SetLastErrorModel3dName(t, i) {
            e.set(i, t)
        },
        Error3dModelName() {
            return e.get(this)
        },
        Name() {
            return this._GetName()
        },
        Meshes() {
            return this._GetMeshes()
        },
        MeshCount() {
            return this._GetMeshCount()
        },
        MeshAt(t) {
            return this._GetMeshAt(t)
        },
        Animation() {
            return this._GetAnimation()
        },
        AnimationCount() {
            return this._GetAnimationsCount()
        },
        AnimationAt(t) {
            return this._GetAnimationAt(t)
        },
        AnimationDuration(t) {
            return this._GetAnimationDuration(t)
        },
        Progress() {
            return this._GetProgress()
        },
        CurMesh() {
            return this._GetMeshAt(this._GetForIndex("mesh"))
        },
        CurAnimation() {
            return this._GetAnimationAt(this._GetForIndex("animation"))
        },
        OffsetX() {
            return this._GetOffsetX()
        },
        OffsetY() {
            return this._GetOffsetY()
        },
        OffsetZ() {
            return this._GetOffsetZ()
        },
        RotationX() {
            return t.toDegrees(this._GetRotationX())
        },
        RotationY() {
            return t.toDegrees(this._GetRotationY())
        },
        RotationZ() {
            return t.toDegrees(this._GetRotationZ())
        },
        ScaleX() {
            return this._GetScaleX()
        },
        ScaleY() {
            return this._GetScaleY()
        },
        ScaleZ() {
            return this._GetScaleZ()
        },
        OriginX() {
            return this._GetOriginAsString(this._GetOriginX(), "x")
        },
        OriginY() {
            return this._GetOriginAsString(this._GetOriginY(), "y")
        },
        OriginZ() {
            return this._GetOriginAsString(this._GetOriginZ(), "z")
        },
        QuaternionX() {
            return this._GetQuaternion()[0]
        },
        QuaternionY() {
            return this._GetQuaternion()[1]
        },
        QuaternionZ() {
            return this._GetQuaternion()[2]
        },
        QuaternionW() {
            return this._GetQuaternion()[3]
        },
        Mesh() {
            return this._GetMesh()
        }
    }
}

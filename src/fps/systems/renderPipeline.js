import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

export function chooseGraphicsPreset(qualityProfiles) {
  const mobile = window.matchMedia("(pointer: coarse)").matches;
  const highDpr = (window.devicePixelRatio || 1) > 2;
  if (!mobile) {
    return "desktop_high";
  }
  return highDpr ? "mobile_low" : "mobile_high";
}

export class RenderPipeline {
  constructor({ renderer, scene, camera, qualityProfile }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.qualityProfile = qualityProfile;
    this.composer = null;
    this.fxaaPass = null;
  }

  init() {
    const profile = this.qualityProfile;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.8;
    this.renderer.shadowMap.enabled = Boolean(profile.shadows);
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    composer.addPass(renderPass);

    if (profile.ssao) {
      const ssaoPass = new SSAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight);
      ssaoPass.kernelRadius = 8;
      ssaoPass.minDistance = 0.002;
      ssaoPass.maxDistance = 0.18;
      composer.addPass(ssaoPass);
    }

    if (profile.bloom) {
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.36, 0.8, 0.72);
      composer.addPass(bloomPass);
    }

    const fxaaPass = new ShaderPass(FXAAShader);
    composer.addPass(fxaaPass);

    this.composer = composer;
    this.fxaaPass = fxaaPass;
    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(width, height) {
    if (!this.composer || !this.fxaaPass) {
      return;
    }
    const pixelRatio = this.renderer.getPixelRatio();
    this.composer.setSize(width, height);
    const material = this.fxaaPass.material;
    material.uniforms.resolution.value.x = 1 / (width * pixelRatio);
    material.uniforms.resolution.value.y = 1 / (height * pixelRatio);
  }

  render(dt) {
    if (!this.composer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.composer.render(dt);
  }
}

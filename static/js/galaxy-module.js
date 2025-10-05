const EarthPos = { x: -8200, y: 0, z: 20 };

const GalaxyModule = {
    scene: null,
    camera: null,
    renderer: null,
    raycaster: null,
    mouse: null,
    starObjects: [],
    starPoints: null,
    galaxyBackground: null,
    controls: {
        isDragging: false,
        previousMousePosition: { x: 0, y: 0 },
        dragStartPosition: { x: 0, y: 0 },
        hasDragged: false
    },
    currentZoom: 1,
    pointSizeConfig: {
        min: 10,
        max: 20,
        base: 10
    },
    hoveredStarIndex: null,
    originalColors: [],
    originalSizes: [],
    debugHitboxes: false,
    hitboxHelpers: [],

    init() {
        this.debugHitboxes = false;
        this.setupScene();
        this.createGalaxyBackground();
        this.addLighting();
        this.setupControls();
        this.animate();
    },

    setupScene() {
        this.scene = new THREE.Scene();

        const container = document.getElementById('galaxy-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.0001, 1000000);
        this.camera.position.set(0, 500, 1000);
        this.camera.lookAt(EarthPos.x, EarthPos.y, EarthPos.z);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);

        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points.threshold = 10;
        this.mouse = new THREE.Vector2();

        this.createEarthIndicator();
    },

    createEarthIndicator() {
        const earthGeometry = new THREE.SphereGeometry(0.01, 16, 16);
        const earthMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFCC33,
            emissive: 0xFFCC33,
            transparent: true,
            opacity: 0.8
        });
        this.earthIndicator = new THREE.Mesh(earthGeometry, earthMaterial);
        this.earthIndicator.position.set(0, 0, 0);
        this.scene.add(this.earthIndicator);
    },

    createGalaxyBackground() {
        function getGalaxyThickness(radius) {
            const thinDiskThickness = 350;
            const thickDiskThickness = 1200;
            const solarRadius = 8200;
            const flareRadius = 10000;
            const flareFactor = 0.1;

            let thickness = thinDiskThickness;
            if (radius > solarRadius) {
                const thickDiskFraction = Math.min(1, (radius - solarRadius) / (flareRadius - solarRadius));
                thickness = thinDiskThickness * (1 - thickDiskFraction) + thickDiskThickness * thickDiskFraction;
            }

            if (radius > flareRadius) {
                const flareKpc = (radius - flareRadius) / 1000;
                thickness *= (1 + flareFactor * flareKpc);
            }

            return Math.max(thickness, thinDiskThickness);
        }

        const positions = [];
        const colors = [];

        const numArms = 4;
        const armWidth = 500;
        const rotations = 0.08;
        const minRadius = 500;
        const maxRadius = 35000;

        for (let arm = 0; arm < numArms; arm++) {
            const armAngleOffset = (arm / numArms) * Math.PI * 2 + 0.35;

            for (let i = 0; i < 3000; i++) {
                const radius = minRadius + Math.random() * (maxRadius - minRadius);
                const spiralAngle = (radius / 600) * rotations + armAngleOffset;
                const angleVariation = (Math.random() - 0.5) * 0.5;
                const radiusVariation = (Math.random() - 0.5) * armWidth;

                const finalAngle = spiralAngle + angleVariation;
                const finalRadius = radius + radiusVariation;

                const x = finalRadius * Math.cos(finalAngle);
                const z = finalRadius * Math.sin(finalAngle);
                const y = (Math.random() - 0.5) * getGalaxyThickness(finalRadius);

                positions.push(x - EarthPos.x, y - EarthPos.y, z - EarthPos.z);

                const distanceFromArmCore = Math.abs(radiusVariation) / armWidth;
                const intensity = 0.8 + (1 - distanceFromArmCore) * 0.4 + Math.random() * 0.3;

                colors.push(intensity, intensity * 0.95, intensity * 0.85);
            }
        }

        for (let i = 0; i < 2000; i++) {
            const radius = Math.random() * 3200;
            const theta = Math.random() * Math.PI * 2;
            const phi = (Math.random() - 0.5) * Math.PI * 0.3;

            const x = 2 * radius * Math.cos(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * 0.4;
            const z = radius * Math.cos(phi) * Math.sin(theta);

            positions.push(x - EarthPos.x, y - EarthPos.y, z - EarthPos.z);

            const intensity = 0.9 + Math.random() * 0.4;
            colors.push(intensity, intensity * 0.9, intensity * 0.7);
        }

        for (let i = 0; i < 1500; i++) {
            const radius = minRadius + Math.random() * (maxRadius - minRadius);
            const theta = Math.random() * Math.PI * 2;
            const y = (Math.random() - 0.5) * 150;

            const x = radius * Math.cos(theta);
            const z = radius * Math.sin(theta);

            positions.push(x - EarthPos.x, y - EarthPos.y, z - EarthPos.z);

            const intensity = 0.5 + Math.random() * 0.4;
            colors.push(intensity * 0.9, intensity * 0.9, intensity);
        }

        for (let i = 0; i < 1000; i++) {
            const radius = 3000 + Math.random() * 2000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;

            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta) * 0.6;
            const z = radius * Math.cos(phi);

            positions.push(x - EarthPos.x, y - EarthPos.y, z - EarthPos.z);

            const intensity = 0.4 + Math.random() * 0.3;
            colors.push(intensity * 0.8, intensity * 0.8, intensity * 0.9);
        }

        const galaxyGeometry = new THREE.BufferGeometry();
        galaxyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        galaxyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const galaxyMaterial = new THREE.PointsMaterial({
            size: 15,
            vertexColors: true,
            transparent: true,
            opacity: 1.0,
            sizeAttenuation: true,
            map: this.createCircleTexture(),
        });
        
        const galaxyFarMaterial = new THREE.PointsMaterial({
            size: 1,
            color: 0xcccccc,
            vertexColors: true,
            sizeAttenuation: false,
        });

        this.galaxyBackground = new THREE.Points(galaxyGeometry, galaxyMaterial);
        this.galaxyBackground_far = new THREE.Points(galaxyGeometry, galaxyFarMaterial);
        this.scene.add(this.galaxyBackground);
        this.scene.add(this.galaxyBackground_far);

        const dustGeometry = new THREE.BufferGeometry();
        const dustVertices = [];
        const dustColors = [];

        for (let arm = 0; arm < numArms; arm++) {
            const armAngleOffset = (arm / numArms) * Math.PI * 2 + Math.PI / numArms;

            for (let i = 0; i < 800; i++) {
                const radius = minRadius + Math.random() * (maxRadius - minRadius);
                const spiralAngle = (radius / 600) * rotations + armAngleOffset;
                const angleVariation = (Math.random() - 0.5) * 0.3;

                const finalAngle = spiralAngle + angleVariation;
                const radiusVariation = (Math.random() - 0.5) * 150;
                const finalRadius = radius + radiusVariation;

                const x = finalRadius * Math.cos(finalAngle);
                const z = finalRadius * Math.sin(finalAngle);
                const y = (Math.random() - 0.5) * 80;

                dustVertices.push(x - EarthPos.x, y - EarthPos.y, z - EarthPos.z);

                const intensity = 0.1 + Math.random() * 0.15;
                dustColors.push(intensity, intensity * 0.8, intensity * 0.6);
            }
        }

        dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustVertices, 3));
        dustGeometry.setAttribute('color', new THREE.Float32BufferAttribute(dustColors, 3));

        const dustMaterial = new THREE.PointsMaterial({
            size: 18,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.NormalBlending,
            sizeAttenuation: true,
            map: this.createCircleTexture(),
        });

        this.galaxyDust = new THREE.Points(dustGeometry, dustMaterial);
        this.scene.add(this.galaxyDust);
    },

    toggleBackground(show) {
        if (this.galaxyBackground) {
            this.galaxyBackground.visible = show;
        }
        if (this.galaxyDust) {
            this.galaxyDust.visible = show;
        }
    },

    addLighting() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
        directionalLight.position.set(0, 1000, 0);
        this.scene.add(directionalLight);
    },

    createCircleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 64, 64);
        const centerX = 32;
        const centerY = 32;

        const centerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 4);
        centerGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        centerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = centerGradient;
        ctx.fillRect(0, 0, 64, 64);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 4;

        const gradientH = ctx.createLinearGradient(0, centerY, 64, centerY);
        gradientH.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradientH.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
        gradientH.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        gradientH.addColorStop(0.7, 'rgba(255, 255, 255, 0.6)');
        gradientH.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradientH;
        ctx.fillRect(0, centerY - 1.5, 64, 3);

        const gradientV = ctx.createLinearGradient(centerX, 0, centerX, 64);
        gradientV.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradientV.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
        gradientV.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        gradientV.addColorStop(0.7, 'rgba(255, 255, 255, 0.6)');
        gradientV.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradientV;
        ctx.fillRect(centerX - 1.5, 0, 3, 64);

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(Math.PI / 4);
        ctx.translate(-centerX, -centerY);
        const gradientD1 = ctx.createLinearGradient(centerX, 0, centerX, 64);
        gradientD1.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradientD1.addColorStop(0.4, 'rgba(255, 255, 255, 0.3)');
        gradientD1.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
        gradientD1.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
        gradientD1.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradientD1;
        ctx.fillRect(centerX - 1, 0, 2, 64);
        ctx.restore();

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(-Math.PI / 4);
        ctx.translate(-centerX, -centerY);
        const gradientD2 = ctx.createLinearGradient(centerX, 0, centerX, 64);
        gradientD2.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradientD2.addColorStop(0.4, 'rgba(255, 255, 255, 0.3)');
        gradientD2.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
        gradientD2.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
        gradientD2.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradientD2;
        ctx.fillRect(centerX - 1, 0, 2, 64);
        ctx.restore();

        return new THREE.CanvasTexture(canvas);
    },

    async loadData(filters = {}) {
        this.showLoader(true);

        const dataset = InputModule.currentDataset;
        const params = new URLSearchParams();

        Object.keys(filters).forEach(key => {
            if (filters[key] !== undefined && filters[key] !== null) {
                params.append(key, filters[key]);
            }
        });

        try {
            const response = await fetch(`/api/data/${dataset}?${params}`);
            const data = await response.json();

            if (!data.error) {
                this.updateStars(data);
                document.getElementById('star-count').textContent = data.length;
                document.getElementById('filtered-count').textContent = data.length;
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.showStatus('Failed to load data', 'error');
        } finally {
            this.showLoader(false);
        }
    },

    getStarColor(star) {
        if (star.prediction !== undefined) {
            const prob = star.prediction;

            if (prob >= 0.7) {
                return { r: 0.2, g: 1.0, b: 0.2 };
            } else if (prob >= 0.5) {
                return { r: 0.4, g: 1.0, b: 0.3 };
            } else if (prob >= 0.3) {
                return { r: 0.7, g: 1.0, b: 0.3 };
            } else {
                return { r: 1.0, g: 0.9, b: 0.4 };
            }
        }

        return { r: 0.9, g: 0.9, b: 0.9 };
    },

    updateStars(data) {
        if (this.starPoints) {
            this.scene.remove(this.starPoints);
            if (this.starPoints.geometry) this.starPoints.geometry.dispose();
            if (this.starPoints.material) this.starPoints.material.dispose();
        }
        this.starObjects = [];
        this.originalColors = [];
        this.originalSizes = [];

        if (data.length === 0) return;

        const positions = [];
        const colors = [];
        const sizes = [];

        data.forEach(star => {
            const brightness = star.brightness || 0.5;
            const baseSize = this.pointSizeConfig.base * brightness;

            positions.push(star.x || 0, star.y || 0, star.z || 0);

            const color = this.getStarColor(star);
            colors.push(color.r, color.g, color.b);

            this.originalColors.push(color.r, color.g, color.b);
            this.originalSizes.push(baseSize);

            sizes.push(baseSize);

            this.starObjects.push({
                data: star,
                baseSize: baseSize
            });
        });

        const starsGeometry = new THREE.BufferGeometry();
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        starsGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

        const starsMaterial = new THREE.PointsMaterial({
            size: this.pointSizeConfig.base,
            vertexColors: true,
            transparent: true,
            opacity: 1.0,
            sizeAttenuation: true,
            depthWrite: false,
            map: this.createCircleTexture(),
        });

        const galaxyFarMaterial = new THREE.PointsMaterial({
            size: 1,
            color: 0xcccccc,
            vertexColors: true,
            sizeAttenuation: false,
        });

        this.starPoints = new THREE.Points(starsGeometry, starsMaterial);
        this.galaxyBackground_far = new THREE.Points(starsGeometry, galaxyFarMaterial);

        this.scene.add(this.starPoints);
        this.scene.add(this.galaxyBackground_far);

        this.updateStarSizes();
        this.updateHitboxVisuals();
    },

    updateHitboxVisuals() {
        // Remove existing hitbox helpers
        this.hitboxHelpers.forEach(helper => {
            this.scene.remove(helper);
            if (helper.geometry) helper.geometry.dispose();
            if (helper.material) helper.material.dispose();
        });
        this.hitboxHelpers = [];

        if (!this.debugHitboxes || !this.starPoints) return;

        const cameraDistance = this.camera.position.length();
        const threshold = Math.max(15, Math.min(200, cameraDistance / 5)) / 20;

        // Create a sphere for each star showing the raycasting threshold
        const positions = this.starPoints.geometry.attributes.position.array;
        
        for (let i = 0; i < positions.length / 3; i++) {
            const x = positions[i * 3];
            const y = positions[i * 3 + 1];
            const z = positions[i * 3 + 2];

            const geometry = new THREE.SphereGeometry(threshold, 8, 8);
            const material = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.2,
                wireframe: true
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, y, z);
            
            this.scene.add(mesh);
            this.hitboxHelpers.push(mesh);
        }
    },

    updateStarSizes() {
        if (!this.starPoints) return;

        const cameraDistance = this.camera.position.length();
        // Better scaling for all zoom levels
        const scaleFactor = Math.max(0.8, Math.min(3, cameraDistance / 300));

        let finalSize = this.pointSizeConfig.base * scaleFactor;
        finalSize = Math.max(this.pointSizeConfig.min, Math.min(this.pointSizeConfig.max, finalSize));

        this.starPoints.material.size = finalSize;
        
        // When zoomed out far, make stars appear as bright white dots
        const farThreshold = 5000; // Distance at which stars start becoming white dots
        const veryFarThreshold = 1000000; // Distance at which all stars are white dots
        
        if (cameraDistance > farThreshold) {
            const colors = this.starPoints.geometry.attributes.color.array;
            const whiteFactor = Math.min(1, (cameraDistance - farThreshold) / (veryFarThreshold - farThreshold));
            
            for (let i = 0; i < colors.length / 3; i++) {
                // Skip the currently hovered star
                if (i === this.hoveredStarIndex) continue;
                
                const baseR = this.originalColors[i * 3];
                const baseG = this.originalColors[i * 3 + 1];
                const baseB = this.originalColors[i * 3 + 2];
                
                // Interpolate towards white (1, 1, 1)
                colors[i * 3] = baseR + (1 - baseR) * whiteFactor;
                colors[i * 3 + 1] = baseG + (1 - baseG) * whiteFactor;
                colors[i * 3 + 2] = baseB + (1 - baseB) * whiteFactor;
            }
            
            this.starPoints.geometry.attributes.color.needsUpdate = true;
        } else {
            // Restore original colors when zoomed in
            const colors = this.starPoints.geometry.attributes.color.array;
            for (let i = 0; i < colors.length / 3; i++) {
                if (i === this.hoveredStarIndex) continue;
                
                colors[i * 3] = this.originalColors[i * 3];
                colors[i * 3 + 1] = this.originalColors[i * 3 + 1];
                colors[i * 3 + 2] = this.originalColors[i * 3 + 2];
            }
            this.starPoints.geometry.attributes.color.needsUpdate = true;
        }
        
        // Update hitbox visuals when zoom changes
        if (this.debugHitboxes) {
            this.updateHitboxVisuals();
        }
    },
    
    setupControls() {
        const container = this.renderer.domElement;

        container.addEventListener('mousemove', (e) => this.onMouseMove(e));
        container.addEventListener('click', (e) => this.onMouseClick(e));
        container.addEventListener('wheel', (e) => this.onMouseWheel(e));
        container.addEventListener('mousedown', (e) => this.onMouseDown(e));
        container.addEventListener('mouseup', () => this.onMouseUp());
        container.addEventListener('mouseleave', () => this.onMouseUp());
    },

    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const tooltip = document.getElementById('tooltip');

        if (this.controls.isDragging) {
            tooltip.classList.remove('active');

            const deltaX = event.clientX - this.controls.previousMousePosition.x;
            const deltaY = event.clientY - this.controls.previousMousePosition.y;

            const dragDistance = Math.sqrt(
                Math.pow(event.clientX - this.controls.dragStartPosition.x, 2) +
                Math.pow(event.clientY - this.controls.dragStartPosition.y, 2)
            );

            if (dragDistance > 5) {
                this.controls.hasDragged = true;
            }

            const spherical = new THREE.Spherical();
            spherical.setFromVector3(this.camera.position);
            spherical.theta -= deltaX * 0.01;
            spherical.phi += deltaY * 0.01;
            spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
            this.camera.position.setFromSpherical(spherical);
            this.camera.lookAt(0, 0, 0);

            this.controls.previousMousePosition = { x: event.clientX, y: event.clientY };
        } else {
            if (!this.starPoints) return;

            const cameraDistance = this.camera.position.length();
            // More aggressive threshold - scales better with zoom
            this.raycaster.params.Points.threshold = Math.max(15, Math.min(200, cameraDistance / 5)) / 20;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObject(this.starPoints);

            if (intersects.length > 0) {
                const index = intersects[0].index;
                const star = this.starObjects[index]?.data;

                if (!star) return;

                // Reset previous hovered star if different
                if (this.hoveredStarIndex !== undefined && this.hoveredStarIndex !== index) {
                    const colors = this.starPoints.geometry.attributes.color.array;
                    const sizes = this.starPoints.geometry.attributes.size.array;

                    colors[this.hoveredStarIndex * 3] = this.originalColors[this.hoveredStarIndex * 3];
                    colors[this.hoveredStarIndex * 3 + 1] = this.originalColors[this.hoveredStarIndex * 3 + 1];
                    colors[this.hoveredStarIndex * 3 + 2] = this.originalColors[this.hoveredStarIndex * 3 + 2];
                    sizes[this.hoveredStarIndex] = this.originalSizes[this.hoveredStarIndex];

                    this.starPoints.geometry.attributes.color.needsUpdate = true;
                    this.starPoints.geometry.attributes.size.needsUpdate = true;
                }

                // Highlight current star
                const colors = this.starPoints.geometry.attributes.color.array;
                const sizes = this.starPoints.geometry.attributes.size.array;

                colors[index * 3] = 1.0;
                colors[index * 3 + 1] = 1.0;
                colors[index * 3 + 2] = 1.0;
                sizes[index] = this.originalSizes[index] * 10.0; // Big but not too big

                this.starPoints.geometry.attributes.color.needsUpdate = true;
                this.starPoints.geometry.attributes.size.needsUpdate = true;

                // Build tooltip
                let tooltipContent = `<h4>${star.star_name || 'Unknown Star'}</h4>`;
                tooltipContent += `<p>Planets: ${star.num_planets || 1}</p>`;

                if (star.distance_pc) {
                    tooltipContent += `<p>Distance: ${star.distance_pc.toFixed(1)} ly</p>`;
                }

                if (star.stellar_temp) {
                    tooltipContent += `<p>Temperature: ${star.stellar_temp.toFixed(0)} K</p>`;
                }

                if (star.prediction !== undefined) {
                    tooltipContent += `<p><strong>Prediction: ${(star.prediction * 100).toFixed(1)}%</strong></p>`;
                }

                tooltip.innerHTML = tooltipContent;
                tooltip.style.left = (event.clientX - 60) + 'px';
                tooltip.style.top = (event.clientY + 25) + 'px';
                tooltip.classList.add('active');

                this.renderer.domElement.style.cursor = 'pointer';
                this.hoveredStarIndex = index;
            } else {
                // No star hovered - reset
                if (this.hoveredStarIndex !== undefined) {
                    const colors = this.starPoints.geometry.attributes.color.array;
                    const sizes = this.starPoints.geometry.attributes.size.array;

                    colors[this.hoveredStarIndex * 3] = this.originalColors[this.hoveredStarIndex * 3];
                    colors[this.hoveredStarIndex * 3 + 1] = this.originalColors[this.hoveredStarIndex * 3 + 1];
                    colors[this.hoveredStarIndex * 3 + 2] = this.originalColors[this.hoveredStarIndex * 3 + 2];
                    sizes[this.hoveredStarIndex] = this.originalSizes[this.hoveredStarIndex];

                    this.starPoints.geometry.attributes.color.needsUpdate = true;
                    this.starPoints.geometry.attributes.size.needsUpdate = true;
                    this.hoveredStarIndex = undefined;
                }

                tooltip.classList.remove('active');
                this.renderer.domElement.style.cursor = 'default';
            }
        }
    },

    onMouseClick(event) {
        if (this.controls.hasDragged) {
            return;
        }

        this.raycaster.setFromCamera(this.mouse, this.camera);

        if (this.starPoints) {
            const intersects = this.raycaster.intersectObject(this.starPoints);

            if (intersects.length > 0) {
                const index = intersects[0].index;
                const star = this.starObjects[index].data;
                StarSystemModule.open(star.star_name);
            }
        }
    },

    onMouseWheel(event) {
        event.preventDefault();
        const zoom = event.deltaY > 0 ? 1.1 : 0.9;

        const newLength = this.camera.position.length() * zoom;

        // Increased minimum distance to prevent zooming past stars
        if (newLength > 0.1 && newLength < 30000) {
            this.camera.position.multiplyScalar(zoom);
            this.camera.lookAt(0, 0, 0);
            this.updateStarSizes();
        }
    },

    onMouseDown(event) {
        this.controls.isDragging = true;
        this.controls.hasDragged = false;
        this.controls.previousMousePosition = { x: event.clientX, y: event.clientY };
        this.controls.dragStartPosition = { x: event.clientX, y: event.clientY };
        this.renderer.domElement.style.cursor = 'grabbing';
    },

    onMouseUp() {
        this.controls.isDragging = false;
        this.renderer.domElement.style.cursor = 'default';

        setTimeout(() => {
            this.controls.hasDragged = false;
        }, 50);
    },

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.earthIndicator) {
            const time = Date.now() * 0.001;
            const scale = 1 + Math.sin(time * 2) * 0.01;
            this.earthIndicator.scale.set(scale, scale, scale);
        }

        // Add pulsing effect to hovered star
        if (this.hoveredStarIndex !== undefined && this.starPoints) {
            const time = Date.now() * 0.001;
            const pulse = 1 + Math.sin(time * 8) * 0.2; // Fast pulse
            const sizes = this.starPoints.geometry.attributes.size.array;
            sizes[this.hoveredStarIndex] = this.originalSizes[this.hoveredStarIndex] * 15.0 * pulse;
            this.starPoints.geometry.attributes.size.needsUpdate = true;
        }

        this.renderer.render(this.scene, this.camera);

        if (StarSystemModule.isOpen) {
            StarSystemModule.animate();
        }
    },

    showLoader(show) {
        document.getElementById('loader').classList.toggle('active', show);
    },

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('status-message');
        statusEl.textContent = message;
        statusEl.className = `status-message active ${type}`;

        setTimeout(() => {
            statusEl.classList.remove('active');
        }, 3000);
    },

    handleResize() {
        const container = document.getElementById('galaxy-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        if (this.camera && this.renderer) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }
    }
};
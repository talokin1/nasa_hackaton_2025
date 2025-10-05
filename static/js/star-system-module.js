// ============================================
// Module 3: Star System Popup Module
// Handles the detailed star system visualization
// ============================================

const StarSystemModule = {
    scene: null,
    camera: null,
    renderer: null,
    planets: [],
    isOpen: false,
    currentStar: null,

    init() {
        document.getElementById('close-modal').addEventListener('click', () => this.close());
        document.getElementById('star-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('star-modal')) {
                this.close();
            }
        });
    },

    async open(starName) {
        this.currentStar = starName;
        this.isOpen = true;
        document.getElementById('star-modal').style.display = 'block';

        try {
            const response = await fetch(`/api/star_system/${starName}`);
            const data = await response.json();

            if (!data.error) {
                this.createStarSystem(data);
            } else {
                GalaxyModule.showStatus(`Star system not found: ${starName}`, 'error');
                this.close();
            }
        } catch (error) {
            console.error('Error loading star system:', error);
            GalaxyModule.showStatus('Failed to load star system', 'error');
            this.close();
        }
    },

    close() {
        this.isOpen = false;
        document.getElementById('star-modal').style.display = 'none';
        document.getElementById('planet-info').classList.remove('active');

        if (this.renderer) {
            // Clean up Three.js resources
            this.planets.forEach(planet => {
                if (planet.mesh) {
                    this.scene.remove(planet.mesh);
                    planet.mesh.geometry.dispose();
                    planet.mesh.material.dispose();
                }
            });

            this.renderer.dispose();
            this.renderer = null;
            this.scene = null;
            this.camera = null;
            this.planets = [];
        }
    },

    createStarSystem(data) {
        const container = document.getElementById('star-system-container');
        container.innerHTML = '';

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000033);

        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.set(0, 30, 80);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);

        // Create star
        const starGeometry = new THREE.SphereGeometry(8, 32, 32);
        const starMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(data.star_color),
            emissive: new THREE.Color(data.star_color),
            emissiveIntensity: 1
        });
        const star = new THREE.Mesh(starGeometry, starMaterial);
        this.scene.add(star);

        // Add glow effect
        const glowGeometry = new THREE.SphereGeometry(12, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(data.star_color),
            transparent: true,
            opacity: 0.3
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.scene.add(glow);

        // Add light
        const starLight = new THREE.PointLight(data.star_color, 2, 200);
        starLight.position.set(0, 0, 0);
        this.scene.add(starLight);

        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);

        // Add planets
        this.planets = [];
        data.planets.forEach((planet, index) => {
            const orbitRadius = 20 + index * 12;
            const planetSize = Math.max(1, planet.planet_radius || planet.pl_rade || 1) * 0.8;

            // Create orbit line
            const orbitCurve = new THREE.EllipseCurve(0, 0, orbitRadius, orbitRadius, 0, 2 * Math.PI);
            const orbitPoints = orbitCurve.getPoints(64);
            const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
            const orbitMaterial = new THREE.LineBasicMaterial({
                color: 0x404080,
                transparent: true,
                opacity: 0.3
            });
            const orbit = new THREE.Line(orbitGeometry, orbitMaterial);
            orbit.rotation.x = Math.PI / 2;
            this.scene.add(orbit);

            // Create planet
            const planetGeometry = new THREE.SphereGeometry(planetSize, 16, 16);
            const planetMaterial = new THREE.MeshPhongMaterial({
                color: this.getPlanetColor(planet),
                shininess: 100
            });
            const planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);
            planetMesh.position.set(orbitRadius, 0, 0);
            planetMesh.userData = planet;

            this.scene.add(planetMesh);

            const orbitalPeriod = planet.orbital_period || planet.pl_orbper || 100;
            this.planets.push({
                mesh: planetMesh,
                orbit: orbitRadius,
                speed: 0.5 / Math.sqrt(orbitalPeriod),
                angle: Math.random() * Math.PI * 2,
                data: planet
            });
        });

        // Setup interaction
        container.addEventListener('mousemove', (e) => this.onSystemMouseMove(e));

        // Add camera controls
        this.setupSystemControls(container);
    },

    getPlanetColor(planet) {
        // Color based on planet characteristics
        if (planet.habitability_score > 0.7 || planet.prediction > 0.7) {
            return 0x4080ff; // Blue - potentially habitable
        }
        if ((planet.planet_radius || planet.pl_rade || 1) > 2) {
            return 0xff8040; // Orange - gas giant
        }
        if (planet.st_teff && planet.st_teff > 6000) {
            return 0xffff80; // Yellow - hot star system
        }
        return 0x808080; // Gray - rocky/unknown
    },

    setupSystemControls(container) {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };

        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        container.addEventListener('mouseup', () => {
            isDragging = false;
        });

        container.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;

                // Rotate camera
                const spherical = new THREE.Spherical();
                spherical.setFromVector3(this.camera.position);
                spherical.theta -= deltaX * 0.01;
                spherical.phi += deltaY * 0.01;
                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
                this.camera.position.setFromSpherical(spherical);
                this.camera.lookAt(0, 0, 0);

                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });

        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoom = e.deltaY > 0 ? 1.1 : 0.9;
            const newLength = this.camera.position.length() * zoom;

            if (newLength > 20 && newLength < 200) {
                this.camera.position.multiplyScalar(zoom);
                this.camera.lookAt(0, 0, 0);
            }
        });
    },

    onSystemMouseMove(event) {
        if (!this.renderer) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);

        const intersects = raycaster.intersectObjects(this.planets.map(p => p.mesh));
        const planetInfo = document.getElementById('planet-info');

        if (intersects.length > 0) {
            const planet = intersects[0].object.userData;

            // Build comprehensive planet info
            let infoHTML = `<h3>${planet.planet_name || 'Unknown Planet'}</h3>`;

            // Display all available properties
            const properties = [
                { key: 'star_name', label: 'Star', unit: '' },
                { key: 'planet_radius', label: 'Radius', unit: 'Earth radii' },
                { key: 'pl_rade', label: 'Radius', unit: 'Earth radii' },
                { key: 'planet_mass', label: 'Mass', unit: 'Earth masses' },
                { key: 'pl_bmasse', label: 'Mass', unit: 'Earth masses' },
                { key: 'orbital_period', label: 'Orbital Period', unit: 'days' },
                { key: 'pl_orbper', label: 'Orbital Period', unit: 'days' },
                { key: 'distance_pc', label: 'Distance from Earth', unit: 'ly' },
                { key: 'st_teff', label: 'Star Temperature', unit: 'K' },
                { key: 'habitability_score', label: 'Habitability', unit: '%', transform: v => v * 100 },
                { key: 'prediction', label: 'Prediction Score', unit: '%', transform: v => v * 100 },
                { key: 'right_ascens', label: 'Right Ascension', unit: '°' },
                { key: 'declination', label: 'Declination', unit: '°' }
            ];

            const displayedKeys = new Set();

            properties.forEach(prop => {
                if (planet[prop.key] !== undefined && planet[prop.key] !== null && !displayedKeys.has(prop.label)) {
                    let value = planet[prop.key];
                    if (prop.transform) {
                        value = prop.transform(value);
                    }
                    if (typeof value === 'number') {
                        value = value.toFixed(2);
                    }

                    infoHTML += `
                        <div class="property">
                            <span class="property-name">${prop.label}:</span>
                            <span class="property-value">${value} ${prop.unit}</span>
                        </div>
                    `;
                    displayedKeys.add(prop.label);
                }
            });

            // Add any additional properties not in our list
            Object.keys(planet).forEach(key => {
                if (!properties.some(p => p.key === key) &&
                    !['x', 'y', 'z', 'brightness', 'baseScale'].includes(key) &&
                    planet[key] !== null && planet[key] !== undefined) {
                    let value = planet[key];
                    if (typeof value === 'number') {
                        value = value.toFixed(2);
                    }

                    // Convert snake_case to Title Case
                    const label = key.replace(/_/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());

                    infoHTML += `
                        <div class="property">
                            <span class="property-name">${label}:</span>
                            <span class="property-value">${value}</span>
                        </div>
                    `;
                }
            });

            planetInfo.innerHTML = infoHTML;
            planetInfo.classList.add('active');
        } else {
            planetInfo.classList.remove('active');
        }
    },

    animate() {
        if (!this.isOpen || !this.renderer) return;

        this.planets.forEach(planet => {
            planet.angle += planet.speed * 0.01;
            planet.mesh.position.x = Math.cos(planet.angle) * planet.orbit;
            planet.mesh.position.z = Math.sin(planet.angle) * planet.orbit;
            planet.mesh.rotation.y += 0.01;
        });

        this.renderer.render(this.scene, this.camera);
    },

    handleResize() {
        if (this.isOpen && this.renderer) {
            const container = document.getElementById('star-system-container');
            const width = container.clientWidth;
            const height = container.clientHeight;

            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }
    }
};
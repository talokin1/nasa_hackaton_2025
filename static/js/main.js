// ============================================
// Main Initialization
// Bootstraps all modules and handles global events
// ============================================

// Initialize all modules when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Exoplanet Explorer...');

    // Initialize modules in order
    InputModule.init();
    GalaxyModule.init();
    StarSystemModule.init();

    console.log('All modules initialized successfully');
});

// Handle window resize
window.addEventListener('resize', () => {
    GalaxyModule.handleResize();
    StarSystemModule.handleResize();
});

// Handle keyboard shortcuts
window.addEventListener('keydown', (e) => {
    // Press 'B' to toggle background
    if (e.key === 'b' || e.key === 'B') {
        const checkbox = document.getElementById('show-background');
        checkbox.checked = !checkbox.checked;
        InputModule.showBackground = checkbox.checked;
        GalaxyModule.toggleBackground(checkbox.checked);
    }

    // Press 'ESC' to close star system modal
    if (e.key === 'Escape' && StarSystemModule.isOpen) {
        StarSystemModule.close();
    }

    // Press 'R' to reset camera position (focus on Earth)
    if (e.key === 'r' || e.key === 'R') {
        if (GalaxyModule.camera) {
            GalaxyModule.camera.position.set(1500, 700, 2200);
            GalaxyModule.camera.lookAt(1500, 20, 1500);
            GalaxyModule.updateStarSizes();
        }
    }
});

// Prevent context menu on right click in 3D view
document.getElementById('galaxy-container').addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Error handling
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    GalaxyModule.showStatus('An error occurred. Please refresh the page.', 'error');
});

// Unload warning if there are unsaved changes
window.addEventListener('beforeunload', (e) => {
    // You can add logic here to check for unsaved changes
    // For now, we'll just let the user leave without warning
});
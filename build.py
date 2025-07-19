#!/usr/bin/env python3
"""
Production build script for SlashRoll
Installs dependencies and builds CSS/JS assets
"""

import subprocess
import sys
import os

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"⚡ {description}...")
    try:
        # Use cmd on Windows for better compatibility
        if os.name == 'nt':  # Windows
            result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True, encoding='utf-8')
        else:
            result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed:")
        print(f"Exit code: {e.returncode}")
        print(f"Error output: {e.stderr}")
        return False
    except UnicodeDecodeError:
        print(f"❌ {description} failed due to encoding issue")
        return False

def main():
    """Main build process"""
    print("🚀 Starting SlashRoll production build...")
    
    # Check if Node.js is available
    if not run_command("node --version", "Checking Node.js installation"):
        print("\n❌ Node.js is required but not found. Please install Node.js and npm.")
        sys.exit(1)
    
    # Install npm dependencies
    if not run_command("npm install", "Installing npm dependencies"):
        sys.exit(1)
    
    # Try to update browserslist database first
    print("⚡ Updating browserslist database...")
    subprocess.run("npx update-browserslist-db@latest", shell=True, capture_output=True)
    
    # Build CSS and JS assets
    if not run_command("npm run build", "Building production assets"):
        # If build fails, try installing browserslist-db specifically
        print("⚡ Attempting to fix browserslist issue...")
        run_command("npm install caniuse-lite@latest", "Installing latest caniuse-lite")
        run_command("npx update-browserslist-db@latest", "Updating browserslist database")
        
        # Retry build
        if not run_command("npm run build", "Retrying build with updated browserslist"):
            sys.exit(1)
    
    print("\n✅ Build completed successfully!")
    print("\n📝 To use production mode:")
    print("   1. Set PRODUCTION_MODE=true in your .env file")
    print("   2. Set SECRET_KEY in your .env file if not already set")
    print("   3. Start your Flask application with: python app.py")
    print("\n🔧 For development mode:")
    print("   1. Use npm run watch to watch for changes")
    print("   2. Keep PRODUCTION_MODE=false or unset")

if __name__ == "__main__":
    main()
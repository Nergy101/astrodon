#!/bin/bash

# Install optimizt for image optimization
echo "🔧 Installing optimizt for image optimization..."

# Check if optimizt is already installed
if command -v optimizt &> /dev/null; then
    echo "✅ optimizt is already installed"
    optimizt --version
    exit 0
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Install optimizt globally
echo "📦 Installing optimizt via npm..."
npm install -g @funboxteam/optimizt

# Verify installation
if command -v optimizt &> /dev/null; then
    echo "✅ optimizt installed successfully!"
    optimizt --version
else
    echo "❌ Failed to install optimizt"
    exit 1
fi 
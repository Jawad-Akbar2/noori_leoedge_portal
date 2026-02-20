# HR Employee Portal - Vercel Deployment Guide

## Overview
This guide covers deploying the HR Employee Portal (MERN stack) to Vercel as a monorepo.

## Project Structure

hr-portal/ ├── backend/ │ ├── server.js │ ├── package.json │ ├── .env │ ├── routes/ │ ├── models/ │ ├── middleware/ │ └── seeders/ ├── frontend/ │ ├── src/ │ ├── public/ │ ├── package.json │ ├── .env │ └── build/ ├── vercel.json └── README.md


## Prerequisites
- GitHub account with repository
- Vercel account connected to GitHub
- MongoDB Atlas account (for MongoDB URI)
- Node.js 18+ installed locally

## Local Setup

### 1. Clone Repository
```bash
git clone https://github.com/YOUR-USERNAME/hr-portal.git
cd hr-portal
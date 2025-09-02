# Qwik Invoicing Application
# Introduction
This project is a basic invoicing system built on the Qwik.js framework. It creates product invoices based on customer information. Currently, it only saves the invoices to a local database.
This project demonstrates how Qwik.js technology can be utilized in a basic invoicing system. While Qwik.js is not yet as popular as other frameworks, its key feature is resumability, which allows pages to load extremely quickly by avoiding traditional hydration. It might feel familiar to developers coming from Angular or React. It's another framework for building dynamic web applications, but it stands out by removing the traditional hydration process.
This project serves not only as a demonstration of an invoicing system but also as a hands-on experience with Qwik.js.

# Technologies Used in This Project
* Qwik.js (Qwik & Qwik City)
* SQLite (local, serverless database)
* Node.js & npm (version 18+)
  

# Project Structure
```
├── public/
├── src/
│   ├── components/   
│   │
│   ├── lib/
│   │   └── db.ts             # Database
│   ├── routes/
│       └── index.tsx         # Main page route 
│  
├── package.json
└── README.md

```
# Installation & Usage
## Prerequisites
Verify that you have the following: 

```shell
node -v 
```
```shell
npm -v
```
```shell
git --version
```

## Installation
* Clone this repository to your system.

```shell
git clone https://github.com/ForCharm24MG/qwik-invoicing-app
cd qwik-invoicing-app
```
* Install the Packages
```shell
npm install 
```
* Run the Application
```shell
npm start  
```
## Usage 
Open the url on to your browser.
```shell 
http://localhost:5173
```
```shell 
http://127.0.0.1:5173
```
# Preview of our Application
* ## Customer Page
  <img width="1017" height="796" alt="image" src="https://github.com/user-attachments/assets/300422b2-b03f-45e4-9c98-1357c8080618" />
* ## Products Page
  <img width="1026" height="822" alt="image" src="https://github.com/user-attachments/assets/379090ca-0eec-4012-be79-f12a83f75c48" />
* ## Invoice Page
  <img width="1017" height="620" alt="image" src="https://github.com/user-attachments/assets/6b72d3b7-c4fa-4606-80d8-c24892294b2a" />


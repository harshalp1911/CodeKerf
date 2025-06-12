# 🚀 CodeKerf [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)  [![Docker](https://img.shields.io/badge/Docker-ready-blue.svg)](https://www.docker.com/)  

## Description  
**CodeKerf** is a web-based IDE for real-time co-editing of C++, Python, and Java. Each run executes in an isolated Docker container for security and resource control, while Socket.io and MongoDB persist and sync sessions.
  -  [Live Demo](https://your-demo-link.com)

## Table of Contents  
- [Installation](#installation)  
- [Usage](#usage)  
- [Features](#features)  
- [Tech Stack](#tech-stack)  
- [Folder Structure](#folder-structure)  
- [License](#license)  


---

## 📦Installation  
1. Clone the repo:  
   ```bash
    git clone https://github.com/harshalp1911/CodeKerf.git
    cd codekerf
2. Build and start services:

   ```bash
   docker compose up -d --build
3. Open your browser at `http://localhost:3000`


## Usage
- Open the app at `http://localhost:3000`

- Select a language `(C++, Python, Java).`

- Write or paste your code in the left pane.

- Click `RUN` to compile/execute; output appears in the right pane.

- Click `SAVE` to download the code file.

- Click `SHARE` to copy a session URL—anyone opening it joins the same live workspace.

## Features
🖋 Real-time collaborative editing `(Socket.io)`

💻 Multi-language support with syntax highlighting `(CodeMirror)`

🐳 Secure, isolated `Docker runners` with resource limits

📦 Persistent sessions stored in `MongoDB`

🔗 One-click shareable session `URLs`

##  🛠️ Tech Stack

- **Frontend:**   ![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB) ![CodeMirror](https://img.shields.io/badge/CodeMirror-000000?logo=codemirror&logoColor=white)
- **Backend:** ![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white) ![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white) ![Socket.io](https://img.shields.io/badge/Socket.io-010101?logo=socket.io&logoColor=white)   
- **Database:** ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white) 
- **Execution:**   ![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white) (C++/Python/Java images)
-  **Deployment:**  ![AWS](https://img.shields.io/badge/AWS-232F3E?logo=amazonaws&logoColor=white) ![Docker Compose](https://img.shields.io/badge/Docker--Compose-2496ED?logo=docker&logoColor=white)

## 🏗️  Folder Structure
 ```text
  codekerf/
 ├── client/            
 │   ├── public/        
 │   └── src/           
 │       ├── App.js     
 │       └── ...        
 ├── server/            
 │   └── index.js       
 ├── docker/            
 │   ├── cpp-runner/    
 │   │   └── Dockerfile 
 │   ├── python-runner/ 
 │   │   └── Dockerfile 
 │   └── java-runner/   
 │       └── Dockerfile 
 ├── docker-compose.yml           
```

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📇 Author

Harshal Patil 
- [harshalp0602@gmail.com](#license)  



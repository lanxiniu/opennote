pipeline {
  agent {
    node {
      label 'master'
      customWorkspace '/var/onote/client'
    }
  }

  stages {
    stage('Clone Sources') {
      steps {
        git 'https://github.com/EricRabil/opennote.git'
      }
    }
    stage('Information') {
      steps {
        sh 'node -v'
        sh 'npm -v'
      }
    }
    stage('Dependencies') {
      steps {
        sh 'npm install'
      }
    }
    stage('Build') {
      steps {
        sh 'npm run build'
      }
    }
    stage('Artifacts') {
      steps {
        sh 'tar -czf dist.tar.gz ./dist'
        archiveArtifacts artifacts: 'dist.tar.gz', fingerprint: true
      }
    }
  }
}
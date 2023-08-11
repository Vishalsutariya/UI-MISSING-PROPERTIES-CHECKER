# UI-MISSING-PROPERTIES-CHECKER

Motivation

Had to wake up early morning to add missing properties in the client's environment and 
Had to waste half a day adding missing properties post-deployment and had to do deployment again


How it works

This script fetches the content of the environment.prod.ts files from different folders in your GitHub repository, extracts the properties from each file, and identifies missing properties by comparing them with the properties of the base folder's file. The missing properties are then logged for each folder, helping you identify configuration discrepancies across different environments.

To make the whole process automated, added functionality to add missing properties to the targeted folder and push it to Git Hub. So, developers don't have to do it manually

Result

![image](https://github.com/Vishalsutariya/UI-MISSING-PROPERTIES-CHECKER/assets/30944951/45ec1861-1695-4e6c-860a-e2170146874e)

![image](https://github.com/Vishalsutariya/UI-MISSING-PROPERTIES-CHECKER/assets/30944951/3040b89c-5b4b-4841-aff4-dec6d8e9cb16)

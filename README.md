# Salesforce Student Management Portal (Full-Stack LWC & Apex Architecture)

An enterprise-grade, end-to-end Student Management application built natively on the Salesforce Platform. This project utilizes a highly decoupled, responsive frontend built with **Lightning Web Components (LWC)** and a robust, secure backend driven by an asynchronous **Apex Controller**. 

The system features passwordless OTP authentication, unified financial summaries, dynamic task metrics, and an active risk-monitoring evaluation engine.

---

## Architectural Overview
The portal follows a secure **Client-Server Architecture** designed to maximize platform performance, enforce database security, and reduce client-side network overhead:

1. **Client-Side Layer (LWC UI Bundle):** Executes directly inside the user's web browser, managing structural presentation (HTML), visual layouts (CSS), and user interaction event handlers (JavaScript).
2. **Data-Transfer Layer (Apex Wrappers):** Bundles multi-object relational records into streamlined, serialized custom data structures (`@AuraEnabled` Wrapper classes) to execute high-performance, single-pass data transmissions over the network.
3. **Server-Side Layer (Apex Backend):** Runs securely on the multi-tenant Salesforce Cloud environment, executing targeted database queries (SOQL), managing platform records (DML), and handling transactional system processes (Cryptography and SMTP services).

---

##  Core System Features

* **Passwordless OTP Authentication:** Programmatic multi-factor security pipeline utilizing secure 6-digit verification codes generated on the server and distributed via automated emails.
* **Unified Financial Dashboard:** Dynamic transaction processing that parses financial stages to map total tuition paid versus pending balances.
* **Proactive Performance Analytics:** An academic audit engine that cross-references completion metrics of assignment checklists alongside profile scores to categorize student standing.
* **Dynamic Automated Guardrails:** Immediate front-end UI transformations that render high-visibility alerting modules if a profile's active performance metrics breach critical safety boundaries.

---

## Technical Stack & Component Breakdown

### 1. Front-End Presentation Layer (LWC)
The interface is contained within a unified component bundle, with each file serving a highly specialized technical function:

* **`studentPortal.html` (UI Skeleton):** Establishes the webpage Document Object Model (DOM) tree. Implements structured text inputs, layout card slots, and grid containers. Employs structural directives (`lwc:if`, `lwc:for:each`) for reactive view modifications based on active state parameters.
* **`studentPortal.css` (Visual Presentation):** Configures layout elasticity using CSS Flexbox rules (`display: flex`). Dictates modern UI treatments including vector linear-gradients, component depth elevation (`box-shadow`), and smooth spatial transformations (`transition`). Uses specialized state styling flags (`.gpa-excellent` vs `.gpa-risk`) to instantly alternate system typography color palettes based on data states.
* **`studentPortal.js` (Client-Side Intelligence):** Written in modern ECMAScript (ES6+). Intercepts interface events, handles client-side state reactivity, and manages backend-facing data handshakes via asynchronous JavaScript Promises (`.then()` and `.catch()`).
* **`studentPortal.js-meta.xml` (Component Configuration):** Platform metadata defining system properties. Configures layout availability using the `<isExposed>` tag and declares explicit deployment target containers (e.g., `LightningHomePage`, `LightningAppPage`).

### 2. Back-End Server Layer (Apex)
* **`StudentManagementController.cls` (Operational Controller):** A server-side class compiled with `with sharing` architecture to enforce structural record-level sharing security and object permissions. Houses explicitly exposed `@AuraEnabled` methods that process incoming frontend calls, execute specialized logic loops, and manipulate persistence stores.
* **Wrapper Classes (Custom Data Contracts):** Custom, lightweight virtual objects configured inside the controller file to streamline payload packages. 
  * `StudentWrapper` & `StudentDashboardWrapper`: Aggregate diverse database primitives (Strings, Decimals, Booleans, and Arrays) into an optimized single-object package, shielding the frontend from executing multiple slow, independent database roundtrips.

---

##  Database Schema & Relational Architecture

The system coordinates data exchange across five primary database tables. It leverages standard CRM structures alongside custom fields and specialized **Record Types**:

[Account (University)] <--- (University_Lookup__c) --- [Account (Student)]
|
+---------------------+---------------------+
|                                           |
(AccountId)                              (WhatId)
|                                           |
[Opportunity (Tuition)]              [Task (Assignments)]

### 1. Account Object
The central repository for entity profiles, structurally segregated into two distinct database layouts using platform **Record Types**:
* **Student Record Type:** Holds custom properties tracking academic profiles:
  * `Major__c` (Text): The student's academic track.
  * `Current_GPA__c` (Decimal): Cumulative numeric grade average.
  * `Student_Email__c` (Email): Unique identification index string.
  * `Student_Status__c` (Picklist): Track state (`Prospect`, `Applicant`, `Enrolled`, `Alumnus`).
  * `Login_Verification_Code__c` (Text): Caches temporary security tokens.
  * `University_Lookup__c` (Lookup Relationship): Direct reference key pointing back to a University Account.
* **University Record Type:** Houses master educational institution details.

### 2. Opportunity Object (Repurposed for Tuition)
Manages financial transaction profiles. Tied to the master Student Profile via a standard **Lookup Relationship** foreign key (`AccountId`).
* `Amount` (Currency): The transactional value of the record.
* `StageName` (Picklist): Operational state identifier. Records set to `'Closed Won'` denote settled balances; all other states signify pending tuition obligations.

### 3. Task Object (Repurposed for Assignments)
Tracks short-term action tasks related to student performance. Linked to the Account table via the standard polymorphic foreign key field (`WhatId`).
* `Subject` (Text): Title of the assignment item.
* `Status` (Picklist): Track states (e.g., `'Completed'`, `'In Progress'`).
* `Priority` (Picklist): Determines structural weight (`High`, `Normal`, `Low`).

### 4. Login_Verification__c Object
A custom, independent staging table utilized exclusively to cache transient token data during authentication sequences before permanent deletion.
* `Email__c` (Text): Captures username strings.
* `Code__c` (Text): Stores active, unexpired verification codes.
* `Role__c` (Text): Maps authorization tiers (`'Student'`, `'Registrar'`).

### 5. User Object
Standard Salesforce administrative profile directory table checked by the controller backend to isolate and validate corporate system logins against custom administrative properties (`Login_Verification_Code__c`).

---

##  Core Application Workflow Logic

### 1. Passwordless OTP Authentication Lifecycle

[LWC Frontend] --- (Passes Email) ---> [Apex Controller] ---> Generates Crypto Code
^                                      |
|                                      +------------> Inserts Staging Record & Sends Email
|                                                              |
[Enters 6-Digit Code] ------------------------------------------------+
|
v
[Apex Verification] ---> Valid Matches? ---> Yes ---> Deletes Staging Record & Authenticates


1. A user enters an email on the frontend layout (`.html`), triggering an event captured by the script controller (`.js`).
2. The script executes an asynchronous call to the backend Apex method `requestVerificationCode`.
3. The server uses `Crypto.getRandomInteger()` to assemble an unpredictable, 6-digit verification code.
4. The system updates the token field on the target profile record and inserts an administrative verification record into `Login_Verification__c`.
5. The system invokes `Messaging.SingleEmailMessage` to send the authentication code directly to the student's email inbox.
6. When the user inputs the code, the frontend transmits the data string to the backend method `verifyLoginCode`. Upon verification, the Apex engine deletes the staging record from `Login_Verification__c` and updates user state variables to establish an authorized session.

### 2. Financial Aggregation Engine
When loading the primary dashboard, the Apex controller invokes specialized loops to compile real-time financial statements:
1. It queries all child `Opportunity` records linked to the verified student via the `AccountId` parameter.
2. It processes the collection using conditional logic:
   * If `StageName == 'Closed Won'`, the transaction amount accumulates into the wrapper variable `tuitionPaid`.
   * For all other stage values, the currency amount accumulates into the wrapper variable `tuitionDue`.
3. The finalized wrapper container is returned as a structured JSON object to the front-end for immediate layout population.

### 3. Performance Grading & Dynamic Risk Alerts
1. The Apex controller executes a relational SOQL search across the `Task` object where `WhatId` aligns with the student profile.
2. It initializes integer counters, incrementing an open task variable or a completed task variable by inspecting the `Status` picklist values.
3. The server evaluates the numeric value extracted from `Current_GPA__c`. If the decimal falls below `2.0`, the system automatically toggles a boolean flag (`isAtRisk`) to `true`.
4. The backend packages these calculated fields inside the data wrapper and serializes it over the network.
5. The client-side JavaScript intercepts the payload, updating a reactive framework property. This update instantly forces the HTML template engine to render an alert banner on the screen, styled dynamically using critical crimson accents driven by the component's CSS stylesheet.

---

## Installation & Deployment Instructions

To deploy this project to a Salesforce Scratch Org or Developer Sandbox, follow these CLI steps:

1. **Clone the Repository:**
   ```bash
   git clone [https://github.com/YourGitHubUsername/YourRepoName.git](https://github.com/YourGitHubUsername/YourRepoName.git)
   cd YourRepoName


2. Authenticate with Your Salesforce Org:
sf org login web -a studentPortalOrg

3. Deploy Source Code & Metadata:
sf project deploy start --target-org studentPortalOrg

4. Assign Object Permissions:
Ensure your target user profile or permission set has verified read/write access to the required fields on the Account, Opportunity, Task, and custom Login_Verification__c objects.`

5.Add Component to Canvas:
Open the Salesforce Lightning App Builder, select your target App Page, Home Page, or Record Page layout, and drag and drop the studentPortal component onto the visual viewport canvas.

(Note: Email for registar is not implemented due to security concerns, you can add yours by going to line 3 of "StudentManagementController.cls" and find `this line "private static final String REGISTRAR_EMAIL = ' ';" and input the mail you want to use for the "registar" login.)


## Seeding Mock Data for Testing

To fully visualize and test the capabilities of the Student Management Portal, your Salesforce environment needs populated records that match our custom relational database schema. This data ensures the application can calculate dynamic financials, generate performance charts, and test conditional safety alerts across every student lifecycle state.

To make this process seamless, a complete mock data installation script is provided below. It generates:
1. **One Educational Institution** using the `University` Account Record Type.
2. **Five distinct Student Profiles** mapping out every platform status (**Prospect**, **Applicant**, **Enrolled**, and **Alumnus**).
3. **Financial tracking records** (`Opportunity`) to test balanced tuition calculations.
4. **Academic checklists** (`Task`) to populate performance progress widgets.

###  Execution Instructions (Salesforce Developer Console)

1. Log into your Salesforce target organization.
2. Click on the **Gear Icon** in the top right corner and open the **Developer Console**.
3. Press **`Ctrl + E`** (or go to `Debug > Open Execute Anonymous Window`).
4. Completely clear any existing code inside the dialog box.
5. Copy the entire Apex script block below, paste it into the editor, and click **Execute**.

```apex
// ==========================================
// MOCK DATA GENERATION SCRIPT FOR STUDENT PORTAL
// ==========================================

// 1. Retrieve Record Type IDs dynamically using SObject Info Maps
Id univRecTypeId = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName().get('University').getRecordTypeId();
Id studentRecTypeId = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName().get('Student').getRecordTypeId();

// 2. Instantiate and Insert Parent Institutional Node
Account testUniv = new Account(
    Name = 'Apex Global University',
    RecordTypeId = univRecTypeId
);
insert testUniv;

// 3. Instantiate Student Target Archetypes mapping all lifecycle statuses
List<Account> studentsToInsert = new List<Account>();

// Student A: Active, High Performance, Cleared Balances [ENROLLED]
Account studentExcellent = new Account(
    Name = 'Rojer Kha',
    Student_Email__c = 'killerrojer9966@yopmail.com',
    Major__c = 'Computer Science',
    Current_GPA__c = 3.85,
    Student_Status__c = 'Enrolled',
    University_Lookup__c = testUniv.Id,
    RecordTypeId = studentRecTypeId
);

// Student B: Active, Low Performance [ENROLLED - TRIGGERS ACADEMIC ALERT]
Account studentAtRisk = new Account(
    Name = 'msha Shrestha',
    Student_Email__c = 'msha.shrestha@yopmail.com',
    Major__c = 'Artificial Intelligence',
    Current_GPA__c = 1.75, // Lower than 2.0 safety floor
    Student_Status__c = 'Enrolled',
    University_Lookup__c = testUniv.Id,
    RecordTypeId = studentRecTypeId
);

// Student C: Processing Admission, Outstanding Split Balance [APPLICANT]
Account studentAverage = new Account(
    Name = 'rin Shah',
    Student_Email__c = 'rinshah@yopmail.com',
    Major__c = 'Data Science',
    Current_GPA__c = 2.75,
    Student_Status__c = 'Applicant',
    University_Lookup__c = testUniv.Id,
    RecordTypeId = studentRecTypeId
);

// Student D: Marketing Lead, No Academic Records Yet [PROSPECT]
Account studentProspect = new Account(
    Name = 'Anil Thapa',
    Student_Email__c = 'anil.thapa@yopmail.com',
    Major__c = 'Information Technology',
    Current_GPA__c = 0.00,
    Student_Status__c = 'Prospect',
    University_Lookup__c = testUniv.Id,
    RecordTypeId = studentRecTypeId
);

// Student E: Graduated Student, Historical Records [ALUMNUS]
Account studentAlumnus = new Account(
    Name = 'Deepa Rai',
    Student_Email__c = 'deepa.rai@yopmail.com',
    Major__c = 'Software Engineering',
    Current_GPA__c = 3.90,
    Student_Status__c = 'Alumnus',
    University_Lookup__c = testUniv.Id,
    RecordTypeId = studentRecTypeId
);

studentsToInsert.add(studentExcellent);
studentsToInsert.add(studentAtRisk);
studentsToInsert.add(studentAverage);
studentsToInsert.add(studentProspect);
studentsToInsert.add(studentAlumnus);
insert studentsToInsert;

// 4. Instantiate and Link Repurposed Financial Records (Opportunities)
List<Opportunity> tuitionLedger = new List<Opportunity>();

// Allocations for Rojer (Enrolled): All transactions finalized ('Closed Won')
tuitionLedger.add(new Opportunity(
    Name = 'Rojer Khadgi - Fall Tuition Base',
    StageName = 'Closed Won',
    Amount = 5500.00,
    CloseDate = Date.today().addDays(-30),
    AccountId = studentExcellent.Id
));

// Allocations for sha (Enrolled - At Risk): Completely Outstanding Balance Due
tuitionLedger.add(new Opportunity(
    Name = 'sha Shrestha - Fall Tuition Full Invoice',
    StageName = 'Qualification', // Registers as Pending Balance Due
    Amount = 6000.00,
    CloseDate = Date.today().addDays(10),
    AccountId = studentAtRisk.Id
));

// Allocations for rin (Applicant): Split deposit payment completed, balance remaining
tuitionLedger.add(new Opportunity(
    Name = 'rin Shah - Admission Deposit',
    StageName = 'Closed Won',
    Amount = 1500.00,
    CloseDate = Date.today().addDays(-15),
    AccountId = studentAverage.Id
));
tuitionLedger.add(new Opportunity(
    Name = 'rin Shah - Term Fee Balance',
    StageName = 'Prospecting', // Registers as Pending Balance Due
    Amount = 4000.00,
    CloseDate = Date.today().addDays(45),
    AccountId = studentAverage.Id
));

// Allocations for Deepa (Alumnus): Fully Settled Historical Fees
tuitionLedger.add(new Opportunity(
    Name = 'Deepa Rai - Final Graduation Fee',
    StageName = 'Closed Won',
    Amount = 5000.00,
    CloseDate = Date.today().addDays(-365),
    AccountId = studentAlumnus.Id
));

insert tuitionLedger;

// 5. Instantiate and Link Academic Assignments (Tasks)
List<Task> academicChecklist = new List<Task>();

// Assignments for Rojer (100% Completion Rate Processing)
academicChecklist.add(new Task(
    Subject = 'Apex Enterprise Control Frameworks',
    Status = 'Completed',
    Priority = 'High',
    WhatId = studentExcellent.Id,
    ActivityDate = Date.today().addDays(-2)
));
academicChecklist.add(new Task(
    Subject = 'Asynchronous JavaScript Wire Architectures',
    Status = 'Completed',
    Priority = 'Normal',
    WhatId = studentExcellent.Id,
    ActivityDate = Date.today().addDays(-1)
));

// Assignments for sha (0% Completion Rate with Impending Deadlines)
academicChecklist.add(new Task(
    Subject = 'Remedial Data Structures Logic Reconstruction',
    Status = 'In Progress',
    Priority = 'High',
    WhatId = studentAtRisk.Id,
    ActivityDate = Date.today().addDays(2)
));
academicChecklist.add(new Task(
    Subject = 'Platform Metadata Compilation Exam',
    Status = 'Not Started',
    Priority = 'High',
    WhatId = studentAtRisk.Id,
    ActivityDate = Date.today().addDays(4)
));

// Assignments for rin (50% Split Completion Rate Processing)
academicChecklist.add(new Task(
    Subject = 'Advanced SOQL Joins and Optimization Labs',
    Status = 'Completed',
    Priority = 'High',
    WhatId = studentAverage.Id,
    ActivityDate = Date.today().addDays(-5)
));
academicChecklist.add(new Task(
    Subject = 'Data Virtualization Patterns using DTO Wrappers',
    Status = 'Not Started',
    Priority = 'Normal',
    WhatId = studentAverage.Id,
    ActivityDate = Date.today().addDays(6)
));

insert academicChecklist;

System.debug('>> [SUCCESS] Portal Environment Lifecycle Seed Complete. Ready for status validation tracking.');


(For obtaining verification code you can visit the corresponding yopmail of students, eg: For Deepa Rai, you can check deepa.rai@yopmail.com)
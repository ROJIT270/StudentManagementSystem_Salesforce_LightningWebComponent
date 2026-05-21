public with sharing class StudentManagementController {

    private static final String REGISTRAR_EMAIL = ' ';

    public class StudentWrapper {
        @AuraEnabled public String studentId;
        @AuraEnabled public String studentName;
        @AuraEnabled public String studentEmail;
        @AuraEnabled public String universityName;
        @AuraEnabled public String universityId;
        @AuraEnabled public String major;
        @AuraEnabled public Decimal gpa;
        @AuraEnabled public Decimal tuitionPaid;
        @AuraEnabled public Decimal tuitionDue;
        @AuraEnabled public String studentStatus;
        @AuraEnabled public Boolean isAtRisk;
    }

    public class ProgressStep {
        @AuraEnabled public String id;
        @AuraEnabled public String label;
        @AuraEnabled public String state;
        @AuraEnabled public String stepClass;
    }

    public class NotificationItem {
        @AuraEnabled public String id;
        @AuraEnabled public String title;
        @AuraEnabled public String message;
        @AuraEnabled public String type;
        @AuraEnabled public String classes;
    }

    public class StudentDashboardWrapper {
        @AuraEnabled public String studentId;
        @AuraEnabled public String studentName;
        @AuraEnabled public String studentEmail;
        @AuraEnabled public String universityName;
        @AuraEnabled public String status;
        @AuraEnabled public String statusBadgeClass;
        @AuraEnabled public String gpa;
        @AuraEnabled public String tuitionPaid;
        @AuraEnabled public String tuitionDue;
        @AuraEnabled public Boolean isAtRisk;
        @AuraEnabled public Boolean isEnrolled;
        @AuraEnabled public Boolean isApplicant;
        @AuraEnabled public Boolean isProspect;
        @AuraEnabled public Boolean isAlumnus;
        @AuraEnabled public List<ProgressStep> applicationProgress;
        @AuraEnabled public List<NotificationItem> notifications;
    }

    @AuraEnabled(cacheable=true)
    public static Id getStudentRecordTypeId() {
        return Schema.SObjectType.Account
            .getRecordTypeInfosByDeveloperName()
            .get('Student')
            .getRecordTypeId();
    }

    @AuraEnabled(cacheable=true)
    public static Id getUniversityRecordTypeId() {
        return Schema.SObjectType.Account
            .getRecordTypeInfosByDeveloperName()
            .get('University')
            .getRecordTypeId();
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getUniversityOptions() {
        List<Map<String, String>> options = new List<Map<String, String>>();
        for (Account acc : [
            SELECT Id, Name
            FROM   Account
            WHERE  RecordType.DeveloperName = 'University'
            ORDER  BY Name ASC
        ]) {
            options.add(new Map<String, String>{
                'label' => acc.Name,
                'value' => acc.Id
            });
        }
        return options;
    }

    @AuraEnabled(cacheable=true)
    public static List<StudentWrapper> getStudents(String universityId, String studentSearch) {
        List<StudentWrapper> studentList = new List<StudentWrapper>();

        String query =
            'SELECT Id, Name, Major__c, Current_GPA__c, Student_Email__c, ' +
            '       Student_Status__c, University_Lookup__c, University_Lookup__r.Name ' +
            'FROM   Account ' +
            'WHERE  RecordType.DeveloperName = \'Student\'';

        if (String.isNotBlank(universityId)) {
            query += ' AND University_Lookup__c = :universityId';
        } else if (String.isNotBlank(studentSearch)) {
            String searchKey = '%' + studentSearch + '%';
            query += ' AND Name LIKE :searchKey';
        }

        List<Account> students = Database.query(query);
        if (students.isEmpty()) return studentList;

        Set<Id> studentIds = new Map<Id, Account>(students).keySet();
        List<Opportunity> allOpps = [
            SELECT Id, Amount, StageName, AccountId
            FROM   Opportunity
            WHERE  AccountId IN :studentIds
        ];

        for (Account stu : students) {
            StudentWrapper sw  = new StudentWrapper();
            sw.studentId       = stu.Id;
            sw.studentName     = stu.Name;
            sw.studentEmail    = stu.Student_Email__c;
            sw.universityName  = stu.University_Lookup__r != null ? stu.University_Lookup__r.Name : 'Independent';
            sw.universityId    = stu.University_Lookup__c;
            sw.major           = stu.Major__c          != null ? stu.Major__c          : 'Undeclared';
            sw.gpa             = stu.Current_GPA__c    != null ? stu.Current_GPA__c    : 0.0;
            sw.studentStatus   = stu.Student_Status__c != null ? stu.Student_Status__c : 'Prospect';
            sw.isAtRisk        = (sw.studentStatus == 'Enrolled' && sw.gpa < 2.0);
            sw.tuitionPaid     = 0;
            sw.tuitionDue      = 0;

            for (Opportunity opp : allOpps) {
                if (opp.AccountId == stu.Id) {
                    Decimal amt = opp.Amount != null ? opp.Amount : 0;
                    if (opp.StageName == 'Closed Won') sw.tuitionPaid += amt;
                    else                               sw.tuitionDue  += amt;
                }
            }
            studentList.add(sw);
        }
        return studentList;
    }

    @AuraEnabled(cacheable=true)
    public static StudentDashboardWrapper getStudentDashboard(String email) {
        try {
            if (String.isBlank(email)) {
                throw new AuraHandledException('Email is required to load the student dashboard.');
            }
            email = email.trim();

            List<Account> students = [
                SELECT Id, Name, Student_Email__c, Student_Status__c, Current_GPA__c,
                       University_Lookup__r.Name
                FROM   Account
                WHERE  RecordType.DeveloperName = 'Student'
                  AND Student_Email__c = :email
                LIMIT  1
            ];
            if (students.isEmpty()) {
                throw new AuraHandledException('No student record found for this email.');
            }
            
            Account student = students[0];

        Decimal gpaValue = student.Current_GPA__c != null ? student.Current_GPA__c : 0;
        Boolean isAtRisk = student.Student_Status__c == 'Enrolled' && gpaValue < 2.0;

        List<Opportunity> opps = [
            SELECT Amount, StageName
            FROM   Opportunity
            WHERE  AccountId = :student.Id
        ];

        Decimal paid = 0;
        Decimal due  = 0;
        for (Opportunity opp : opps) {
            Decimal amount = opp.Amount != null ? opp.Amount : 0;
            if (opp.StageName == 'Closed Won') {
                paid += amount;
            } else {
                due += amount;
            }
        }

        String status = student.Student_Status__c != null ? student.Student_Status__c : 'Prospect';
        String badgeClass = 'slds-badge ';
        if (status == 'Enrolled') {
            badgeClass += 'slds-theme_success';
        } else if (status == 'Applicant') {
            badgeClass += 'slds-theme_warning';
        } else if (status == 'Alumnus') {
            badgeClass += 'slds-theme_inverse';
        } else {
            badgeClass += 'slds-theme_info';
        }

        List<ProgressStep> progressSteps = new List<ProgressStep>();
        if (status == 'Applicant') {
            ProgressStep submittedStep = new ProgressStep();
            submittedStep.id = 'submitted';
            submittedStep.label = 'Submitted';
            submittedStep.state = 'complete';
            submittedStep.stepClass = 'progress-step complete';
            progressSteps.add(submittedStep);

            ProgressStep reviewStep = new ProgressStep();
            reviewStep.id = 'review';
            reviewStep.label = 'Under Review';
            reviewStep.state = 'current';
            reviewStep.stepClass = 'progress-step current';
            progressSteps.add(reviewStep);

            ProgressStep decisionStep = new ProgressStep();
            decisionStep.id = 'decision';
            decisionStep.label = 'Final Decision';
            decisionStep.state = 'pending';
            decisionStep.stepClass = 'progress-step pending';
            progressSteps.add(decisionStep);
        }

        List<NotificationItem> notifications = new List<NotificationItem>();
        if (status == 'Enrolled') {
            NotificationItem welcomeNotification = new NotificationItem();
            welcomeNotification.id = 'enrolled-welcome';
            welcomeNotification.title = 'Welcome back!';
            welcomeNotification.message = 'Your current semester is active. Check grades and finances here.';
            welcomeNotification.type = 'info';
            welcomeNotification.classes = 'notification-item info';
            notifications.add(welcomeNotification);

            if (isAtRisk) {
                NotificationItem warningNotification = new NotificationItem();
                warningNotification.id = 'academic-warning';
                warningNotification.title = 'Academic Alert';
                warningNotification.message = 'Your current GPA has fallen below the threshold. Reach out to your advisor for support.';
                warningNotification.type = 'warning';
                warningNotification.classes = 'notification-item warning';
                notifications.add(warningNotification);
            }
        } else if (status == 'Applicant') {
            NotificationItem applicationNotification = new NotificationItem();
            applicationNotification.id = 'application-update';
            applicationNotification.title = 'Application in progress';
            applicationNotification.message = 'Your application has been submitted and is now under review by admissions.';
            applicationNotification.type = 'info';
            applicationNotification.classes = 'notification-item info';
            notifications.add(applicationNotification);
        } else if (status == 'Prospect') {
            NotificationItem prospectNotification = new NotificationItem();
            prospectNotification.id = 'prospect-start';
            prospectNotification.title = 'Start your journey';
            prospectNotification.message = 'Explore programs and submit your application to get started.';
            prospectNotification.type = 'info';
            prospectNotification.classes = 'notification-item info';
            notifications.add(prospectNotification);
        } else if (status == 'Alumnus') {
            NotificationItem alumniNotification = new NotificationItem();
            alumniNotification.id = 'alumni-congrats';
            alumniNotification.title = 'Congratulations!';
            alumniNotification.message = 'You are now an alumnus. Request graduation records or explore alumni benefits.';
            alumniNotification.type = 'success';
            alumniNotification.classes = 'notification-item success';
            notifications.add(alumniNotification);
        }

        StudentDashboardWrapper result = new StudentDashboardWrapper();
        result.studentId = student.Id;
        result.studentName = student.Name;
        result.studentEmail = student.Student_Email__c;
        result.universityName = student.University_Lookup__r != null ? student.University_Lookup__r.Name : 'Independent';
        result.status = status;
        result.statusBadgeClass = badgeClass;
        result.gpa = String.valueOf(gpaValue.setScale(2));
        result.tuitionPaid = String.valueOf(paid.setScale(2));
        result.tuitionDue = String.valueOf(due.setScale(2));
        result.isAtRisk = isAtRisk;
        result.isEnrolled = status == 'Enrolled';
        result.isApplicant = status == 'Applicant';
        result.isProspect = status == 'Prospect';
        result.isAlumnus = status == 'Alumnus';
        result.applicationProgress = progressSteps;
        result.notifications = notifications;
        return result;
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Error loading dashboard: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteStudent(Id studentId) {
        try {
            delete [SELECT Id FROM Account WHERE Id = :studentId];
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting record: ' + e.getMessage());
        }
    }

    /* ── Custom / Templated Email ─────────────────────────────────────── */
    @AuraEnabled
    public static void sendCustomEmail(Id studentId, String subject, String body) {
        try {
            Account student = [
                SELECT Name, Student_Email__c
                FROM   Account
                WHERE  Id = :studentId
                LIMIT  1
            ];
            if (String.isBlank(student.Student_Email__c)) {
                throw new AuraHandledException(
                    'This student does not have a valid email address on file.'
                );
            }
            Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
            mail.setToAddresses(new String[]{ student.Student_Email__c });
            mail.setSubject(subject);
            mail.setPlainTextBody(body);
            Messaging.sendEmail(new Messaging.SingleEmailMessage[]{ mail });
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Error sending email: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static String requestVerificationCode(String email) {
        if (String.isBlank(email)) {
            throw new AuraHandledException('Please provide your email address.');
        }
        email = email.trim();
        String code = generateVerificationCode();
        String role = 'Student';

        if (email.equalsIgnoreCase(REGISTRAR_EMAIL)) {
            role = 'Registrar';
            List<User> users = [
                SELECT Id, Login_Verification_Code__c
                FROM User
                WHERE Email = :email
                LIMIT 1
            ];
            if (!users.isEmpty()) {
                User registrar = users[0];
                registrar.Login_Verification_Code__c = code;
                update registrar;
            }
        } else {
            List<Account> students = [
                SELECT Id, Student_Email__c, Login_Verification_Code__c
                FROM Account
                WHERE RecordType.DeveloperName = 'Student'
                  AND Student_Email__c = :email
                LIMIT 1
            ];
            if (students.isEmpty()) {
                throw new AuraHandledException('Email not recognized. Please use a registered student or registrar email.');
            }
            Account student = students[0];
            student.Login_Verification_Code__c = code;
            update student;
        }

        upsertLoginVerificationRecord(email, code, role);
        sendVerificationEmail(email, code);
        return role;
    }

    @AuraEnabled
    public static String verifyLoginCode(String email, String code) {
        if (String.isBlank(email) || String.isBlank(code)) {
            throw new AuraHandledException('Both email and verification code are required.');
        }
        email = email.trim();
        code  = code.trim();

        if (email.equalsIgnoreCase(REGISTRAR_EMAIL)) {
            List<User> users = [
                SELECT Id, Login_Verification_Code__c
                FROM User
                WHERE Email = :email
                LIMIT 1
            ];
            if (!users.isEmpty() && users[0].Login_Verification_Code__c == code) {
                User registrar = users[0];
                registrar.Login_Verification_Code__c = null;
                update registrar;
                clearLoginVerificationRecord(email, code);
                return 'Registrar';
            }
            // Fallback to custom object
            Login_Verification__c verification = getLoginVerificationRecord(email, code);
            if (verification != null) {
                String role = verification.Role__c;
                delete verification;
                return role;
            }
        }

        List<Account> students = [
            SELECT Id, Student_Email__c, Login_Verification_Code__c
            FROM Account
            WHERE RecordType.DeveloperName = 'Student'
              AND Student_Email__c = :email
            LIMIT 1
        ];
        if (!students.isEmpty() && students[0].Login_Verification_Code__c == code) {
            Account student = students[0];
            student.Login_Verification_Code__c = null;
            update student;
            clearLoginVerificationRecord(email, code);
            return 'Student';
        }

        throw new AuraHandledException('Invalid verification code for the provided email.');
    }

    private static void upsertLoginVerificationRecord(String email, String code, String role) {
        List<Login_Verification__c> records = [
            SELECT Id
            FROM Login_Verification__c
            WHERE Email__c = :email
            LIMIT 1
        ];
        Login_Verification__c record;
        if (records.isEmpty()) {
            record = new Login_Verification__c(Email__c = email, Code__c = code, Role__c = role);
        } else {
            record = records[0];
            record.Code__c = code;
            record.Role__c = role;
        }
        upsert record;
    }

    private static Login_Verification__c getLoginVerificationRecord(String email, String code) {
        List<Login_Verification__c> records = [
            SELECT Id, Email__c, Code__c, Role__c
            FROM Login_Verification__c
            WHERE Email__c = :email
              AND Code__c = :code
            LIMIT 1
        ];
        return records.isEmpty() ? null : records[0];
    }

    private static void clearLoginVerificationRecord(String email, String code) {
        List<Login_Verification__c> records = [
            SELECT Id
            FROM Login_Verification__c
            WHERE Email__c = :email
              AND Code__c = :code
            LIMIT 1
        ];
        if (!records.isEmpty()) {
            delete records;
        }
    }

    private static String generateVerificationCode() {
        Integer randomValue = Math.mod(Math.abs(Crypto.getRandomInteger()), 1000000);
        return String.valueOf(randomValue).leftPad(6, '0');
    }

    private static void sendVerificationEmail(String email, String code) {
        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        mail.setToAddresses(new String[]{ email });
        mail.setSubject('Student Management Portal Verification Code');
        mail.setPlainTextBody('Your Student Management verification code is: ' + code + '\n\n' +
                              'Enter this 6-digit code to access the portal.');
        Messaging.sendEmail(new Messaging.SingleEmailMessage[]{ mail });
    }

    /* ── Performance Tracker ──────────────────────────────────────────── */
    @AuraEnabled
    public static Map<String, Object> getStudentPerformance(Id studentId) {
        try {
            Account student = [
                SELECT Id, Name, Current_GPA__c
                FROM   Account
                WHERE  Id = :studentId
                LIMIT  1
            ];

            List<Task> tasks = [
                SELECT Id, Subject, Status, Priority, ActivityDate
                FROM   Task
                WHERE  WhatId = :studentId
                ORDER  BY ActivityDate DESC NULLS LAST
                LIMIT  20
            ];

            Integer completedTasks = 0;
            Integer openTasks      = 0;
            for (Task t : tasks) {
                if (t.Status == 'Completed') completedTasks++;
                else                         openTasks++;
            }

            Decimal gpa = student.Current_GPA__c != null ? student.Current_GPA__c : 0;
            String  perfRating;
            if      (gpa >= 3.5) perfRating = 'Excellent';
            else if (gpa >= 3.0) perfRating = 'Good';
            else if (gpa >= 2.0) perfRating = 'Average';
            else                 perfRating = 'At Risk';

            List<Map<String, Object>> taskList = new List<Map<String, Object>>();
            for (Task t : tasks) {
                taskList.add(new Map<String, Object>{
                    'id'           => t.Id,
                    'subject'      => t.Subject      != null ? t.Subject      : '(No Subject)',
                    'status'       => t.Status,
                    'priority'     => t.Priority     != null ? t.Priority     : 'Normal',
                    'activityDate' => t.ActivityDate != null
                                        ? String.valueOf(t.ActivityDate)
                                        : 'N/A'
                });
            }

            return new Map<String, Object>{
                'studentName'       => student.Name,
                'gpa'               => gpa,
                'performanceRating' => perfRating,
                'completedTasks'    => completedTasks,
                'openTasks'         => openTasks,
                'totalTasks'        => tasks.size(),
                'tasks'             => taskList
            };
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching performance data: ' + e.getMessage());
        }
    }
}
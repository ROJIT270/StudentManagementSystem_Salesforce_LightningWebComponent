import { LightningElement, track, wire } from 'lwc';
import { refreshApex }       from '@salesforce/apex';
import { ShowToastEvent }    from 'lightning/platformShowToastEvent';

import getUniversityOptions    from '@salesforce/apex/StudentManagementController.getUniversityOptions';
import getStudents             from '@salesforce/apex/StudentManagementController.getStudents';
import deleteStudent           from '@salesforce/apex/StudentManagementController.deleteStudent';
import getStudentRecordTypeId  from '@salesforce/apex/StudentManagementController.getStudentRecordTypeId';
import getUniversityRecordTypeId from '@salesforce/apex/StudentManagementController.getUniversityRecordTypeId';
import sendCustomEmail         from '@salesforce/apex/StudentManagementController.sendCustomEmail';
import requestVerificationCode from '@salesforce/apex/StudentManagementController.requestVerificationCode';
import verifyLoginCode         from '@salesforce/apex/StudentManagementController.verifyLoginCode';
import getStudentDashboard     from '@salesforce/apex/StudentManagementController.getStudentDashboard';
import getStudentPerformance   from '@salesforce/apex/StudentManagementController.getStudentPerformance';

export default class StudentManagementSystem extends LightningElement {

    /* ── Tracked state ─────────────────────────────────────────────────── */
    @track allStudents      = [];
    @track filteredStudents = [];
    @track uniOptions       = [];

    @track loginEmail       = '';
    @track verificationCode = '';
    @track loginError       = '';
    @track isAuthLoading    = false;
    @track isAuthenticated  = false;
    @track currentUserRole  = '';
    @track loginStage       = 'email';
    @track studentDashboard = null;

    // Modal visibility
    @track isModalOpen       = false;
    @track isEmailModalOpen  = false;
    @track isPerformanceOpen = false;

    // Add / Edit modal
    @track currentRecordId      = null;
    @track entityType           = 'Student';   // 'Student' | 'University'

    // Email compose modal
    @track emailStudentId   = null;
    @track emailStudentName = '';
    @track emailSubject     = '';
    @track emailBody        = '';

    // Performance modal
    @track perfData = null;
    perfBarWidth  = null;

    /* ── Non-tracked state ─────────────────────────────────────────────── */
    currentMode  = 'all';
    selectedUniId = '';
    searchKey    = '';
    statusFilter = 'All';

    wiredStudentResult;
    wiredUniResult;
    studentRecordTypeId;
    universityRecordTypeId;

    /* ── Static option lists ───────────────────────────────────────────── */
    statusOptions = [
        { label: 'Prospect',  value: 'Prospect'  },
        { label: 'Applicant', value: 'Applicant' },
        { label: 'Enrolled',  value: 'Enrolled'  }
    ];

    viewOptions = [
        { label: 'By University', value: 'university' },
        { label: 'All Students',  value: 'all'        }
    ];

    /* ── Getters ───────────────────────────────────────────────────────── */
    get modalTitle() {
        if (this.currentRecordId) return 'Update Student Record';
        return this.entityType === 'University' ? 'Add New University' : 'Register New Student';
    }
    get isNewRecord()           { return !this.currentRecordId; }
    get isUniversityMode()      { return this.currentMode === 'university'; }
    get showStudentNewFields()  { return !this.currentRecordId && this.entityType === 'Student'; }
    get showUniversityNewFields(){ return !this.currentRecordId && this.entityType === 'University'; }
    get studentBtnClass()       { return 'entity-btn' + (this.entityType === 'Student'    ? ' active' : ''); }
    get universityBtnClass()    { return 'entity-btn' + (this.entityType === 'University' ? ' active' : ''); }
    get isLoginScreen()         { return !this.isAuthenticated && this.loginStage === 'email'; }
    get isVerifyScreen()        { return !this.isAuthenticated && this.loginStage === 'verify'; }
    get isRegistrar()           { return this.isAuthenticated && this.currentUserRole === 'Registrar'; }
    get isStudent()             { return this.isAuthenticated && this.currentUserRole === 'Student'; }
    get isStudentProfileReady() { return this.isStudent && this.studentDashboard; }

    /** Record type pre-selected on lightning-record-edit-form for new records */
    get formRecordTypeId() {
        if (this.currentRecordId) return null;
        return this.entityType === 'University'
            ? this.universityRecordTypeId
            : this.studentRecordTypeId;
    }

    // Status filter button variants
    get allVar()       { return this.statusFilter === 'All'       ? 'brand' : 'neutral'; }
    get prospectVar()  { return this.statusFilter === 'Prospect'  ? 'brand' : 'neutral'; }
    get applicantVar() { return this.statusFilter === 'Applicant' ? 'brand' : 'neutral'; }
    get enrolledVar()  { return this.statusFilter === 'Enrolled'  ? 'brand' : 'neutral'; }
    get alumnusVar()   { return this.statusFilter === 'Alumnus'   ? 'brand' : 'neutral'; }

    /* ── Wire adapters ─────────────────────────────────────────────────── */
    @wire(getUniversityOptions)
    wiredUnis(result) {
        this.wiredUniResult = result;
        if (result.data) this.uniOptions = result.data;
    }

    @wire(getStudentRecordTypeId)
    wiredRT({ data }) { if (data) this.studentRecordTypeId = data; }

    @wire(getUniversityRecordTypeId)
    wiredUniRT({ data }) { if (data) this.universityRecordTypeId = data; }

    @wire(getStudents, { universityId: '$selectedUniId', studentSearch: '$searchKey' })
    wiredStudents(result) {
        this.wiredStudentResult = result;
        if (result.data) this.processData(result.data);
    }

    /* ── Data processing ───────────────────────────────────────────────── */
    processData(data) {
        this.allStudents = data.map(stu => {
            // Status badge class
            let sClass = 'slds-badge ';
            // Action button defaults
            let btnLabel = 'Send Mail', btnIcon = 'utility:email', actionType = '';

            if (stu.studentStatus === 'Enrolled') {
                sClass += 'slds-theme_info';
                if (stu.isAtRisk) {
                    actionType = 'Warning';
                } else {
                    actionType = 'Performance Report';
                }
            } else if (stu.studentStatus === 'Applicant') {
                sClass += 'slds-theme_warning';
                actionType = 'Admission Update';
            } else if (stu.studentStatus === 'Alumnus') {
                sClass += 'slds-theme_success';
                actionType = 'Graduation Success';
            } else {
                sClass += 'slds-theme_inverse';
                actionType = 'Marketing Info';
            }

            // GPA colour class
            const g         = stu.gpa != null ? Number(stu.gpa) : 0;
            const paid      = stu.tuitionPaid != null ? Number(stu.tuitionPaid) : 0;
            const due       = stu.tuitionDue != null ? Number(stu.tuitionDue) : 0;
            let gpaClass = '';
            if      (g >= 3.5) gpaClass = 'gpa-excellent';
            else if (g >= 3.0) gpaClass = 'gpa-good';
            else if (g >= 2.0) gpaClass = 'gpa-average';
            else               gpaClass = 'gpa-risk';

            return {
                ...stu,
                statusClass     : sClass,
                actionLabel     : btnLabel,
                actionIcon      : btnIcon,
                actionType      : actionType,
                gpaClass        : gpaClass,
                gpa             : g.toFixed(2),
                tuitionPaid     : paid.toFixed(2),
                tuitionDue      : due.toFixed(2),
                isEnrolled      : stu.studentStatus === 'Enrolled',
                showAcademic    : (stu.studentStatus !== 'Prospect' && stu.studentStatus !== 'Applicant'),
                showFinance     : (stu.studentStatus === 'Enrolled'  || stu.studentStatus === 'Alumnus')
            };
        });
        this.applyFilters();
    }

    applyFilters() {
        this.filteredStudents = this.statusFilter === 'All'
            ? [...this.allStudents]
            : this.allStudents.filter(s => s.studentStatus === this.statusFilter);
    }

    /* ── Search / filter handlers ──────────────────────────────────────── */
    handleModeChange(event) {
        this.currentMode  = event.detail.value;
        this.statusFilter = 'All';
        this.selectedUniId = '';
        this.searchKey     = '';
    }

    handleStatusFilter(event) {
        this.statusFilter = event.target.label;
        this.applyFilters();
    }

    handleSearch(event)    { this.searchKey    = event.detail.value; }
    handleUniSelect(event) { this.selectedUniId = event.detail.value; }

    handleLoginEmailChange(event) {
        this.loginEmail = event.detail.value;
        this.loginError = '';
    }

    handleVerificationCodeChange(event) {
        this.verificationCode = event.detail.value;
        this.loginError = '';
    }

    handleSendCode() {
        const email = this.loginEmail?.trim();
        if (!email) {
            this.loginError = 'Please enter your email address.';
            return;
        }
        this.isAuthLoading = true;
        requestVerificationCode({ email })
            .then(role => {
                this.loginError = '';
                this.loginStage = 'verify';
                this.currentUserRole = role;
            })
            .catch(err => {
                this.loginError = err.body?.message || 'Unable to send verification code. Please try again.';
            })
            .finally(() => {
                this.isAuthLoading = false;
            });
    }

    handleVerifyCode() {
        const email = this.loginEmail?.trim();
        const code = this.verificationCode?.trim();
        if (!code) {
            this.loginError = 'Please enter the 6-digit verification code.';
            return;
        }
        this.isAuthLoading = true;
        verifyLoginCode({ email, code })
            .then(role => {
                this.isAuthenticated = true;
                this.currentUserRole = role;
                this.loginError = '';
                if (role === 'Student') {
                    this.loadCurrentStudentDashboard();
                }
            })
            .catch(err => {
                this.loginError = err.body?.message || 'Verification failed. Please try again.';
            })
            .finally(() => {
                this.isAuthLoading = false;
            });
    }

    // ─────────────────────────────────────────────────────────────────────
    // FIX: getStudentDashboard is cacheable=true, so Apex returns a
    // read-only Proxy. Mutating it directly (data.notifications = ...)
    // throws a TypeError inside .then(), which the .catch() intercepts
    // as a plain JS error (no err.body) → shows "Unable to load your
    // dashboard." instead of the real dashboard.
    //
    // Solution: build a brand-new plain JS object — never touch `data`
    // itself.
    // ─────────────────────────────────────────────────────────────────────
    loadCurrentStudentDashboard() {
        const email = this.loginEmail?.trim();
        if (!email) return;

        getStudentDashboard({ email })
            .then(data => {
                if (!data) return;

                // Build applicationProgress — new array of plain objects
                const applicationProgress = Array.isArray(data.applicationProgress)
                    ? data.applicationProgress.map(step => ({
                        id       : step.id,
                        label    : step.label,
                        state    : step.state,
                        stepClass: `progress-step ${step.state}`
                    }))
                    : [];

                // Build notifications — new array of plain objects
                const notifications = Array.isArray(data.notifications)
                    ? data.notifications.map(note => ({
                        id     : note.id,
                        title  : note.title,
                        message: note.message,
                        type   : note.type,
                        classes: `notification-item ${note.type}`
                    }))
                    : [];

                // Assign a completely new plain object — never mutate `data`
                this.studentDashboard = {
                    studentId          : data.studentId,
                    studentName        : data.studentName,
                    studentEmail       : data.studentEmail,
                    universityName     : data.universityName,
                    status             : data.status,
                    statusBadgeClass   : data.statusBadgeClass,
                    gpa                : data.gpa,
                    tuitionPaid        : data.tuitionPaid,
                    tuitionDue         : data.tuitionDue,
                    isAtRisk           : data.isAtRisk,
                    isEnrolled         : data.isEnrolled,
                    isApplicant        : data.isApplicant,
                    isProspect         : data.isProspect,
                    isAlumnus          : data.isAlumnus,
                    applicationProgress: applicationProgress,
                    notifications      : notifications
                };
            })
            .catch(err => {
                this.showToast(
                    'Dashboard Error',
                    err.body?.message || 'Unable to load your dashboard.',
                    'error'
                );
            });
    }

    handlePayNow() {
        this.showToast('Payment', 'Opening the secure payment portal for tuition payment.', 'info');
    }

    handleStartApplication() {
        this.showToast('Start Application', 'Your application process has begun. Check back for status updates.', 'success');
    }

    handleRequestRecords() {
        this.showToast('Request Submitted', 'Graduation records request has been sent to the registrar.', 'success');
    }

    backToEmail() {
        this.loginStage = 'email';
        this.verificationCode = '';
        this.loginError = '';
    }

    handleLogout() {
        this.isAuthenticated = false;
        this.currentUserRole = '';
        this.loginStage = 'email';
        this.loginEmail = '';
        this.verificationCode = '';
        this.loginError = '';
        this.studentDashboard = null;
    }

    /* ── Add / Edit modal ──────────────────────────────────────────────── */
    openModal() {
        this.currentRecordId = null;
        this.entityType      = 'Student';
        this.isModalOpen     = true;
    }

    closeModal() {
        this.isModalOpen       = false;
        this.currentRecordId   = null;
        this.entityType        = 'Student';
    }

    setEntityStudent()    { this.entityType = 'Student'; }
    setEntityUniversity() { this.entityType = 'University'; }

    handleEdit(event) {
        const stuId = event.target.value;
        this.currentRecordId = stuId;
        this.entityType      = 'Student';
        this.isModalOpen     = true;
    }

    handleDelete(event) {
        // eslint-disable-next-line no-alert
        if (!confirm('Are you sure you want to delete this student? This cannot be undone.')) return;
        deleteStudent({ studentId: event.target.value })
            .then(() => {
                this.showToast('Deleted', 'Record removed successfully.', 'success');
                return refreshApex(this.wiredStudentResult);
            })
            .catch(err => {
                this.showToast('Error', err.body?.message || 'Failed to delete record.', 'error');
            });
    }

    handleSubmit(event) {
        event.preventDefault();
        const fields = event.detail.fields;

        if (!this.currentRecordId) {
            /* ── New record ── */
            if (this.entityType === 'Student') {
                fields.RecordTypeId = this.studentRecordTypeId;

                const statCmp = this.template.querySelector('lightning-combobox[name="statSelect"]');
                if (statCmp && !statCmp.value) {
                    statCmp.setCustomValidity('Please select an initial stage.');
                    statCmp.reportValidity();
                    return;
                }
                if (statCmp) { statCmp.setCustomValidity(''); fields.Student_Status__c = statCmp.value; }

            } else {
                /* University creation — RecordTypeId is the only extra field needed */
                fields.RecordTypeId = this.universityRecordTypeId;
            }

        }

        this.template.querySelector('lightning-record-edit-form').submit(fields);
    }

    handleSaveSuccess() {
        const isUni = this.entityType === 'University';
        this.showToast(
            'Success',
            isUni ? 'University created successfully!' : 'Student record saved successfully!',
            'success'
        );
        this.closeModal();
        if (isUni) refreshApex(this.wiredUniResult);   // refresh university picklist
        return refreshApex(this.wiredStudentResult);
    }

    handleError(event) {
        this.showToast('Save Error', event.detail.detail, 'error');
    }

    /* ── Email compose modal ───────────────────────────────────────────── */
    handleAction(event) {
        const studentId = event.target.value;
        const emailType = event.target.dataset.type;
        const student   = this.allStudents.find(s => s.studentId === studentId);
        if (!student) return;

        this.emailStudentId   = studentId;
        this.emailStudentName = student.studentName;
        this.emailSubject     = this.getDefaultSubject(emailType);
        this.emailBody        = this.getDefaultBody(student.studentName, emailType);
        this.isEmailModalOpen = true;
    }

    closeEmailModal() {
        this.isEmailModalOpen  = false;
        this.emailStudentId    = null;
        this.emailStudentName  = '';
        this.emailSubject      = '';
        this.emailBody         = '';
    }

    handleEmailSubjectChange(event) { this.emailSubject = event.detail.value; }
    handleEmailBodyChange(event)    { this.emailBody    = event.detail.value; }

    sendEmail() {
        if (!this.emailSubject?.trim() || !this.emailBody?.trim()) {
            this.showToast('Validation', 'Subject and message body cannot be empty.', 'warning');
            return;
        }
        sendCustomEmail({
            studentId : this.emailStudentId,
            subject   : this.emailSubject,
            body      : this.emailBody
        })
        .then(() => {
            this.showToast('Email Sent!', `Message delivered to ${this.emailStudentName}.`, 'success');
            this.closeEmailModal();
        })
        .catch(err => {
            this.showToast('Email Error', err.body?.message || 'Failed to send email.', 'error');
        });
    }

    getDefaultSubject(emailType) {
        const map = {
            'Warning'           : 'Academic Alert — Enrolled Student at Risk',
            'Performance Report': 'Enrolled Student Progress Update',
            'Graduation Success': 'Alumnus Congratulations & Next Steps',
            'Admission Update'  : 'Applicant Status Update from Admissions',
            'Marketing Info'    : 'Prospective Student Information and Next Steps'
        };
        return map[emailType] || 'Important Information from the University';
    }

    getDefaultBody(name, emailType) {
        const map = {
            'Warning':
`Dear ${name},

We are writing to you because your most recent academic review shows that your GPA has dropped below the threshold needed to maintain good standing as an enrolled student.

Our team is ready to support you with a personalized success plan, tutoring resources, and an advisor meeting to help you get back on track.

Please let us know a convenient time to connect.

Best regards,
Academic Affairs Office`,

            'Performance Report':
`Dear ${name},

Thank you for your continued effort as an enrolled student. Your latest progress report reflects your academic performance and the milestones you are achieving.

We encourage you to keep using the available campus resources so you can maintain strong momentum through the rest of the term.

Best regards,
Academic Affairs Office`,

            'Graduation Success':
`Dear ${name},

Congratulations on successfully completing your studies and earning alumnus status. This is a major achievement, and we are proud to welcome you into our alumni community.

Please explore the alumni benefits, networking opportunities, and support services that are now available to you.

Warmly,
University Administration`,

            'Admission Update':
`Dear ${name},

Thank you for applying to our university. Your application is currently under review by the admissions committee.

We are evaluating your materials carefully and will update you as soon as a decision has been made. In the meantime, feel free to reach out if you have any questions about the process.

Best regards,
Admissions Office`,

            'Marketing Info':
`Dear ${name},

Thank you for your interest in our university. As a prospective student, we want to share helpful information about our programs, campus life, and the application process.

If you have any questions about choosing a major, financial aid, or next steps, we are here to help you explore your options.

Best regards,
Admissions Office`
        };
        return map[emailType] ||
`Dear ${name},

Thank you for your continued engagement with our institution.

Best regards,
The University`;
    }

    /* ── Performance tracker modal ─────────────────────────────────────── */
    handleViewPerformance(event) {
        const studentId      = event.target.value;
        this.perfData        = null;
        this.isPerformanceOpen = true;

        getStudentPerformance({ studentId })
            .then(data => {
                const gpa        = data.gpa || 0;
                const gpaPercent = Math.min((gpa / 4.0) * 100, 100).toFixed(1);
                const rating     = data.performanceRating;

                let barColorClass = 'bar-average';
                let ratingClass   = 'slds-badge slds-theme_warning';

                if      (rating === 'Excellent') { barColorClass = 'bar-excellent'; ratingClass = 'slds-badge slds-theme_success'; }
                else if (rating === 'Good')      { barColorClass = 'bar-good';      ratingClass = 'slds-badge slds-theme_info';    }
                else if (rating === 'At Risk')   { barColorClass = 'bar-risk';      ratingClass = 'slds-badge slds-theme_error';   }

                const total          = data.totalTasks      || 0;
                const done           = data.completedTasks  || 0;
                const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

                const tasks = (data.tasks || []).map((t, i) => ({
                    ...t,
                    id        : t.id || `task-${i}`,
                    taskClass : t.status === 'Completed'
                        ? 'slds-text-color_success'
                        : 'slds-text-color_weak'
                }));

                this.perfBarWidth = gpaPercent;
                this.perfData = {
                    studentName      : data.studentName,
                    gpa              : Number(gpa).toFixed(2),
                    completedTasks   : done,
                    openTasks        : data.openTasks || 0,
                    totalTasks       : total,
                    performanceRating: rating,
                    completionRate,
                    gpaPercent,
                    barClass  : 'performance-bar ' + barColorClass,
                    ratingClass,
                    tasks,
                    hasTasks  : tasks.length > 0
                };
            })
            .catch(() => {
                this.showToast('Error', 'Failed to load performance data.', 'error');
                this.isPerformanceOpen = false;
            });
    }

    closePerformanceModal() {
        this.isPerformanceOpen = false;
        this.perfData          = null;
        this.perfBarWidth      = null;
    }

    renderedCallback() {
        if (this.perfBarWidth !== null) {
            const bar = this.template.querySelector('[data-bar]');
            if (bar) {
                bar.style.width = `${this.perfBarWidth}%`;
            }
        }
    }

    /* ── Utility ───────────────────────────────────────────────────────── */
    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
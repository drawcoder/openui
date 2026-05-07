root = VLayout([contactForm])
contactForm = Form([fullNameField, emailField], "vertical")
fullNameField = {label: "Full Name", name: "fullName", rules: [{required: true}], component: "input"}
emailField = {label: "Email Address", name: "email", rules: [{required: true}], component: "input"}
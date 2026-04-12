document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.querySelector(".menu-toggle");
  const mobileNav = document.querySelector(".mobile-nav");

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener("click", () => {
      mobileNav.classList.toggle("open");
    });
  }

  const forms = document.querySelectorAll("form");

  forms.forEach((form) => {
    const responseEl = form.querySelector(".form-response");
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : "";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (responseEl) {
        responseEl.textContent = "";
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
      }

      try {
        const formData = new FormData(form);

        const request = await fetch(form.action, {
          method: "POST",
          body: formData
        });

        const contentType = request.headers.get("content-type") || "";
        const isJson = contentType.includes("application/json");

        if (request.redirected) {
          window.location.href = request.url;
          return;
        }

        if (request.ok) {
          form.reset();

          if (responseEl) {
            responseEl.textContent =
              "Your message was sent successfully. We’ll get back to you soon.";
          }

          setTimeout(() => {
            window.location.href = "/thank-you.html";
          }, 900);

          return;
        }

        if (isJson) {
          const errorData = await request.json();

          if (responseEl) {
            responseEl.textContent =
              errorData?.error?.message ||
              errorData?.error ||
              "Something went wrong. Please try again.";
          }
        } else {
          if (responseEl) {
            responseEl.textContent =
              "Something went wrong. Please try again.";
          }
        }
      } catch (error) {
        if (responseEl) {
          responseEl.textContent =
            "Unable to send right now. Please try again in a moment.";
        }
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
      }
    });
  });

  // Smart flow: prefill quote form from URL params (demo → quote)
  const params = new URLSearchParams(window.location.search);
  const packageParam = params.get('package');
  const styleParam = params.get('style');

  if (packageParam || styleParam) {
    const projectTypeSelect = document.getElementById('quote-project-type');
    const styleInput = document.getElementById('selectedStyle');

    if (projectTypeSelect && packageParam) {
      const packageMap = {
        'starter': 'Starter Website (1\u20132 pages) \u2014 $125',
        'business': 'Business Website (3\u20135 pages) \u2014 $300',
        'premium': 'Premium Website (5\u20138 pages) \u2014 $600'
      };
      const val = packageMap[packageParam];
      if (val) {
        for (const opt of projectTypeSelect.options) {
          if (opt.text === val) {
            projectTypeSelect.value = opt.value;
            break;
          }
        }
      }
    }

    if (styleInput && styleParam) {
      styleInput.value = styleParam;
    }
  }
});
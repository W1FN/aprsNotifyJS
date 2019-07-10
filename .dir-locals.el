;;; Directory Local Variables
;;; For more information see (info "(emacs) Directory Variables")

((web-mode . ((eval . (progn (prettier-js-mode t)
                        (editorconfig-mode t)))
               (web-mode-script-padding . 0)
               (web-mode-style-padding . 0)))
  (js2-mode . ((eval . (progn (prettier-js-mode t)
                         (editorconfig-mode t))))))

import React from "react"
import { footer } from "../../data/Data"
import { useTranslation } from 'react-i18next'
import "./footer.css"



const Footer = () => {
  const { t } = useTranslation();

  return (
    <>
     
      <footer>
        <div className='container'>
          <div className='box-footer-logo'>
            <div className='logo'>
              <img src='../images/logo2.png' alt='' />
              <h2>{t('footer.help.title')}</h2>
              <p>{t('footer.help.description')}</p>

              <div className='input flex'>
                <input type='text' placeholder={t('footer.help.emailPlaceholder')} />
                <button>{t('footer.help.subscribeButton')}</button>
              </div>
            </div>
          </div>

          {footer.map((val, sectionIndex) => (
            <div className='box-footer' key={val.title}>
              <h3>{t(`footer.sections.${sectionIndex}.title`)}</h3>
              {val.title === "Phương thức thanh toán" ? (
                <div className="payment-methods">
                  {val.text.map((items, index) => (
                    <div key={`${val.title}-${index}`} className="payment-item">
                      <img src={items.list} alt={`Payment method ${index + 1}`} />
                    </div>
                  ))}
                </div>
              ) : (
                <ul>
                  {val.text.map((items, index) => (
                    <li key={`${val.title}-${items.list}-${index}`}> {t(`footer.sections.${sectionIndex}.items.${index}`)} </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </footer>
      <div className='legal'>
        <span>{t('footer.legal.copyright')}</span>
      </div>
    </>
  )
}

export default Footer

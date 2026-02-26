/* ============================================================
   CourseDashboard – Application Logic
   ============================================================
   Parsing · Data Model · Rendering · Search · Sort · Theme

   Architecture Notes (Extension Points):
   ─────────────────────────────────────
   1. DATA MODEL – Each course is a plain object. Add fields like
      `filePath`, `thumbnail`, `tags`, `completed` without
      touching the renderer.
   2. PARSER – `parseCatalog()` is isolated. Swap it with a JSON
      loader by replacing only that function.
   3. RENDERER – `renderCards()` builds all UI. Add click handlers,
      thumbnails, or progress bars inside this function.
   4. FILTER PIPELINE – `getFilteredCourses()` chains category
      filter → search filter → sort. Extend with duration filter,
      tag filter, etc. by adding stages.
   ============================================================ */

// ── Application State ───────────────────────────────────────
const state = {
    /** @type {{ name: string, courses: Course[] }[]} */
    categories: [],

    /** Currently selected category name, or 'all' */
    activeCategory: 'all',

    /** Current search query (lowercase, trimmed) */
    searchQuery: '',

    /** Sort direction: 'asc' | 'desc' */
    sortDir: 'asc',

    /** Total number of courses across all categories */
    totalCourses: 0,
};
// ── Drive Links (from CourseLinks.json) ─────────────────────
const DRIVE_LINKS = {
    'A Practitioner\'s Guide to Private Company Analysis': 'https://drive.google.com/drive/folders/1mgRZmJ7vMgSCQ50FGbk8V-kaAUCNhGBg',
    'Accounting Crash Course': 'https://drive.google.com/drive/folders/1XCFaoUZRCnj5hUh7Bfyv-Az4RnyH--82',
    'Adjusted EBITDA': 'https://drive.google.com/drive/folders/1gV45oWGvVfAJ-TXlwK0mpiVHlzsH6PwV',
    'Advanced Accounting': 'https://drive.google.com/drive/folders/1KxiVQRscIuBWG2J53uX6TosxNlepo3JN',
    'Analyzing Financial Reports': 'https://drive.google.com/drive/folders/1xCtgjIV-re9ZP9lFvr6b7DAY1ZYaTZZs',
    'Artificial Intelligence in PE Due Diligence': 'https://drive.google.com/drive/folders/15g0tGJsawxtBCO88GjtPG7OcpFzDKeXR',
    'Bank and FIG Modeling': 'https://drive.google.com/drive/folders/150PMwgjg0KFsMpUJur2rLb-7xQwZFffG',
    'Biotech Sum of the Parts Valuation': 'https://drive.google.com/drive/folders/1Q1wkva2g6ylWVAjMqUqHtt1Y1A4lOqxO',
    'Building Buyers Lists': 'https://drive.google.com/drive/folders/14HwNttPVtAyROEphVwljb8hU9yTp7uac',
    'Buy-Side Financial Modeling': 'https://drive.google.com/drive/folders/10UqFQJcCSC4fI7_T19q1kpU3RqubPkNY',
    'Buy-Side Stock Analysis': 'https://drive.google.com/drive/folders/1nRq4FEsi6Dh9HlelUK4c8oF1_7fuavsy',
    'CFPAM™ 1: An Introduction to FP&A': 'https://drive.google.com/drive/folders/1V2ZHJmvkCtAltuWHfGaLlUIGKsfoO29t',
    'CFPAM™ 2: Building the Operating Model – The Income Statement': 'https://drive.google.com/drive/folders/1IOAnvlVac2KLW-YWKgeiFeO_2gqN2fJG',
    'CFPAM™ 3: Building the Operating Model – The Balance Sheet': 'https://drive.google.com/drive/folders/12sfBxlM5uDi0uTaeCBtDpe1RgPQZ3WjW',
    'CFPAM™ 4: Building the Operating Model – The Cash Flow Statement': 'https://drive.google.com/drive/folders/1TdtTlVM-SJiuWKv_2hoxjSLhr9Ug24Hn',
    'CFPAM™ 5: Pulling Together the Operating Model': 'https://drive.google.com/drive/folders/1PwaALfc1bb0u5I_eUUxA4jLp2SDrZpgW',
    'CFPAM™ 6: Project Management, Long-Range Planning & Analysis': 'https://drive.google.com/drive/folders/1qUs1uG0eq3MgqBh2lRDwYwpyPmAu01WD',
    'CFPAM™ 7: Presentation Best Practices & Building Dashboards': 'https://drive.google.com/drive/folders/1k5R3_BH7wHI4JzIMgkDtMueH-z6wn8ZD',
    'CFPAM™ Appendix: Corporate Finance Principles': 'https://drive.google.com/drive/folders/12eyVQHzb_Jvf7CsClDa-DbQ0SljxBFpI',
    'Certification in FP&A Modeling (CFPAM)': 'https://drive.google.com/drive/folders/1FsvBF84JIS9jnN7dcmeCnOQxqaXI2Krn',
    'Commercial Mortgage-Backed Securities (CMBS)': 'https://drive.google.com/drive/folders/1lGqBcIeYEI5ujLEe-y2Yz9iLkJIxivPd',
    'Common Mistakes in Calculating Diluted Shares Outstanding': 'https://drive.google.com/drive/folders/1xSS0lvj_clQMRf7UcXtAALohnRGlwAQ8',
    'Corporate Finance Crash Course': 'https://drive.google.com/drive/folders/1A0FNMsMkAgSZAI4FPERYP4zYhFdrEXO-',
    'Corporate Restructuring Primer': 'https://drive.google.com/drive/folders/1fpHZ-KewNpJyVcjobvdkh0QkANOTrT0E',
    'Crash Course in Bonds and Debt': 'https://drive.google.com/drive/folders/1eJKZuShhQg5hjbTf_zkuJeUlaL6zT6vE',
    'DCF Modeling': 'https://drive.google.com/drive/folders/1PYiF8jynNmzt_z5uiZwwWPO4NxBBWCb9',
    'Debt Capital Markets Primer': 'https://drive.google.com/drive/folders/1NXVIqgnGxy5BLH-TIU7onv-_Y-WZ4_hv',
    'Debt Capital Markets: How to Survive Day 1': 'https://drive.google.com/drive/folders/1A7tbvwn_CDsiN2gCvjim5qr69zHKiIRR',
    'Deconstructing Intercompany Investments': 'https://drive.google.com/drive/folders/17SYz8707ryw-N2893HGSin_9WEzjE8de',
    'Deconstructing a Bank\'s Financial Statements': 'https://drive.google.com/drive/folders/1xsPX9ClyxuPMKsGkSCQV3prAXpYNXzcZ',
    'Deconstructing a Maritime Company\'s Financial Statements': 'https://drive.google.com/drive/folders/1PLEfXZmShmpjoYgb5DW2vkeMyq2Y8qnJ',
    'Demystifying Asset Management': 'https://drive.google.com/drive/folders/1OTKThZzN-6FEmmYGdOyHDOPSPMWWe7li',
    'Demystifying Buy-Side Modeling': 'https://drive.google.com/drive/folders/1orZIbAX95-Et0tsGu8iaI1H15qOjl66F',
    'Demystifying Commercial Real Estate Modeling': 'https://drive.google.com/drive/folders/1nQPFJugMpOGPLyN1APOL8uC4LlkYlhYN',
    'Demystifying FIG Investment Banking': 'https://drive.google.com/drive/folders/1RofsKP_rm5BPeZ67LalXLgFV0JI9D1Bz',
    'Demystifying FX Options': 'https://drive.google.com/drive/folders/11vZp7J_t3iWaJYDvxF9UIrVIUBF3mfY4',
    'Demystifying Financial Institutions 101': 'https://drive.google.com/drive/folders/1ok5pIepi4MfI446Hqd_9tcfjgq-x6HaI',
    'Demystifying Hostile Takeovers': 'https://drive.google.com/drive/folders/1z8V-ksSo0Ww_-4n0eWkbv3vvGC7BJX6q',
    'Demystifying Private Credit and Direct Lending': 'https://drive.google.com/drive/folders/1IdbxgXAu1w4YKc4d9-bj2Xhcj7Nra9Vh',
    'Demystifying Quality of Earnings in M&A and Private Equity': 'https://drive.google.com/drive/folders/1VqGshP3YPl2MnDQ0SmCT1Jcs9kpgfFig',
    'Demystifying Restructuring Investment Banking for Incoming Analysts and Associates': 'https://drive.google.com/drive/folders/1IAQlL2U2Ul7l_v4k4oLPNHvIhJ9d3QZn',
    'Demystifying Sell-Side Equity Research': 'https://drive.google.com/drive/folders/1vB_UzOf2QCAZTKaNIfAHDLWqoq51K8aB',
    'Demystifying The Role of an FP&A Professional': 'https://drive.google.com/drive/folders/1ANvlBSK1kzU9MT1ks0krILHWSbIa4EHQ',
    'Demystifying VC Term Sheets & Cap Tables': 'https://drive.google.com/drive/folders/1J2D-L450MRCN2zQP58KMNyJWpeuQttCM',
    'Demystifying the Buy Side: Long/Short Investing': 'https://drive.google.com/drive/folders/1RZGSEU1LZm8Gnjl4bM-9A24yciwWc4sW',
    'Demystifying the Efficient Frontier and Optimal Portfolio': 'https://drive.google.com/drive/folders/1kQgGXtajffyiL8DTwXxXsYGLII09U5oP',
    'Demystifying the Healthcare Sector': 'https://drive.google.com/drive/folders/193ruKZ1zLVQXy4IIg52CRuDtnwTe93Em',
    'Demystifying the Power of AI in Finance': 'https://drive.google.com/drive/folders/16QXz5vby19NMNQcA_ylaFvA3yAt3tIFb',
    'Demystifying the Private Equity Deal Process': 'https://drive.google.com/drive/folders/1Zr5mn1q21mcsmU9ZHzzzEXhZgqM6JfOG',
    'Due Diligence: Competitive Advantages': 'https://drive.google.com/drive/folders/1mRvZRn3gxhKoUrcdQP5iawd_DZCqRE4z',
    'Due Diligence: Defining TAMs': 'https://drive.google.com/drive/folders/1nWLjYPdFs5XrO5OoLVdD1BiyZRX6Mjqf',
    'Due Diligence: Industry Analysis': 'https://drive.google.com/drive/folders/1k7cgNOQyhe1EIhguZRbGoq2KqEchOgFk',
    'EMC© 1: Cash Equities': 'https://drive.google.com/drive/folders/1S6zyJHQmDyYAOcZfDeeCsutw7GWyqd96',
    'EMC© 2: Equity Valuation': 'https://drive.google.com/drive/folders/1dk-sdF0VYUT1lFr6xwEiNMEVTJ0MOmqz',
    'EMC© 3: Equity Indices, Asset Managers and ETFs': 'https://drive.google.com/drive/folders/1uXCldlI_qmlRh9rIXrmILeQX2rBtfYyK',
    'EMC© 4: Equity Futures and Delta One': 'https://drive.google.com/drive/folders/19KHM6nWBpZrW8KRHCZjow_nMF341OTMS',
    'EMC© 5: Hedge Fund Strategies': 'https://drive.google.com/drive/folders/1TmJ-6rP5tpikf01LYgIT6w5HfFd7llcM',
    'EMC© 6: Securities Lending and Prime Brokerage': 'https://drive.google.com/drive/folders/1XzJC9fnkvZVP0bmOBa5CyhakRf9zEb9I',
    'ERC© 1: Equity Research Process': 'https://drive.google.com/drive/folders/1vcTllBTBLKZnduUC7KboPWWlH54N5HZX',
    'ERC© 2: Financial Statement Analysis': 'https://drive.google.com/drive/folders/1bTBLp6F0LIueTBPg_LwuyfWvur-_ZUAN',
    'ERC© 3: Thesis and Due Diligence': 'https://drive.google.com/drive/folders/11wNTeND_JUYtKTVGqt3IO6DA6SPm1Aan',
    'ERC© 4: Writing Research Reports': 'https://drive.google.com/drive/folders/1y6t5SfQf71CSnEr6suiClc7jm-J02qpd',
    'ERC© 5: Financial Statement Modeling': 'https://drive.google.com/drive/folders/1Ha5qTwgk7s3kHKSvY6n8B0NbtWlbaecP',
    'ERC© 6: Relative Valuation': 'https://drive.google.com/drive/folders/1GncqM9t0Kc744c2ALiDKlubu3HPnn5AI',
    'ERC© 7: Intrinsic Valuation': 'https://drive.google.com/drive/folders/1NFiCigqWiHXNB7xBXvcJJivrkGC2bAj0',
    'ERC© 8: Professional Soft Skills': 'https://drive.google.com/drive/folders/11dNEPsDnnuglKBTipdW2u4hOL47_c8vv',
    'ERC© Bonus: Breaking Into Research': 'https://drive.google.com/drive/folders/1EXhxy7REaJ_4ChJyq_Ghei6_pMVVgCUi',
    'ESG Investing, Green Bonds and Social Bonds': 'https://drive.google.com/drive/folders/1bRVWq3ffCQhjpVR4Q3sgq9Qpg8oQZPM1',
    'Excel Basics (Mac)': 'https://drive.google.com/drive/folders/1x5G0XA6ngvMRTnYstecgLm8mfAK93Pvi',
    'Excel Basics (Windows)': 'https://drive.google.com/drive/folders/1wlP9nM6IP-lSwmceltChMUOuJT-VWZk3',
    'Excel Crash Course': 'https://drive.google.com/drive/folders/1uDXqQOiWF_ILjSzhdfBMR02VgTyXEMaq',
    'FIMC© 1: Intro to Financial Markets': 'https://drive.google.com/drive/folders/1hkcxO7DQJBHLM5UQUZu8y8plxhZN5UlO',
    'FIMC© 2: Intro to Fixed Income Trading & Bonds': 'https://drive.google.com/drive/folders/1-c7Udb9uR-Z4qtBe_RlHI7v2UPT74GmV',
    'FIMC© 3: Economics & Role of Central Bank': 'https://drive.google.com/drive/folders/1ZFMhzMxfuX_VYHAZXURmMY3pHo9O-BaE',
    'FIMC© 4: Money Markets': 'https://drive.google.com/drive/folders/17jTspZ8h0dP7n1Orxf5PMWtgLi8p8qot',
    'FIMC© 5: Government Bonds': 'https://drive.google.com/drive/folders/11gGJTMKybonT0fKlRkPn45SxvyJSCxrb',
    'FIMC© 6: Corporate Bonds': 'https://drive.google.com/drive/folders/1yh-r5Ti-XFtU7eihg6XvE_zXrmPm9zuD',
    'FIMC© 7: Mortgage Backed Securities': 'https://drive.google.com/drive/folders/1PpnioVay3fmX8rSgCNVgP9WVg24qC5kM',
    'Financial Modeling and Valuation Mini-Lessons': 'https://drive.google.com/drive/folders/12mAmbhwaahhdsxTLLxlhIkxS-ieOO075',
    'Financial Statement Modeling': 'https://drive.google.com/drive/folders/11iMRmvCQDkIBxgd6k6N9G-wP8c06h8BA',
    'Fixed Income Markets Certification Program (FIMC)': 'https://drive.google.com/drive/folders/1QUQgfL569On7En_s2VJazhc5fPeLMKDL',
    'From Excel User to Excel Master: Demystifying VBA': 'https://drive.google.com/drive/folders/15Bey7_i0FnhFTcrxQ0A8wu5MtRAaIlTf',
    'How to Build an Integrated 3-Statement Model': 'https://drive.google.com/drive/folders/1sx34O8yZN-fsI-S40NL-dH0qCXikOYS9',
    'IB Soft Skills: Tools for Becoming an Amazing Junior Banker': 'https://drive.google.com/drive/folders/1QTI9MyIIZKxQm6BuMIMoQQJtig90cu0R',
    'Insurance Company Financial Statements': 'https://drive.google.com/drive/folders/1toLHWaOxgOERRBRuWtr_JoN9yiqs4a_G',
    'Interpreting Non-GAAP Reports': 'https://drive.google.com/drive/folders/1w2ddcmLcL-WEead4TUHCedsyE4opK9_y',
    'Intro to Financial Statement Modeling': 'https://drive.google.com/drive/folders/1eSVVhs0B0wHesE5NKsR28qsgCrvzuq-K',
    'Introduction to Project Finance': 'https://drive.google.com/drive/folders/1-WzUEykEdY7nS-_99SR9Fbxr--OEzWYY',
    'LBO Modeling': 'https://drive.google.com/drive/folders/1vhy7MI9YXoO-GmU3hjXjRRCqn0mCWnBd',
    'LBO Modeling in the Lower Middle Market': 'https://drive.google.com/drive/folders/1FbPcUHIkaXYJUtuPlPBaQ2K6-X1O7UjP',
    'M&A Modeling': 'https://drive.google.com/drive/folders/1fU6ZjuCiwKC0ii0BLlQzosa8D96Tm_Yx',
    'Modeling Multifamily Real Estate': 'https://drive.google.com/drive/folders/1PBEgEDHTcAjOJz_EpoowHFCMUneEtuo2',
    'Oil & Gas Financial Statements (Different from Oil and Gas Modelling)': 'https://drive.google.com/drive/folders/1T-ESrBV53y3MvCcl78L__5NyAl9sV-GS',
    'Oil & Gas Modeling': 'https://drive.google.com/drive/folders/1wOuwMvAKDJeMKs_mmULoi9TnRD7jJPJu',
    'PowerPoint Crash Course': 'https://drive.google.com/drive/folders/1mEPkwHKhMv_v4RpGopj7CSC58tgG0X9h',
    'PowerPoint Shortcuts for Investment Bankers': 'https://drive.google.com/drive/folders/1ZRHg7pT5rcC6h23UuN_wT435Y3DpBeGt',
    'Private Equity Masterclass': 'https://drive.google.com/drive/folders/10v8FPXaKcNozHksqio1idRiG047Qb_5Q',
    'Private Equity Real Estate Waterfalls': 'https://drive.google.com/drive/folders/1bD--AUynWeNIXpJdFFnCEiFeqs34OAHj',
    'Project Finance Modeling 1: Boot Module and Case Study': 'https://drive.google.com/drive/folders/1Gdhf4K6q603-mmp48-uczJ42E7BGY5oT',
    'Project Finance Modeling 2: Excel DNA for Modelers': 'https://drive.google.com/drive/folders/1JJvD4NQ4664W8sBJSqwXMQ9Iey76CIEN',
    'Project Finance Modeling 3: Blueprint of the Model': 'https://drive.google.com/drive/folders/1RazCSwlhp6cg_TPYQtMuyjWkrCGqO98p',
    'Project Finance Modeling 4: Advanced Debt & Equity': 'https://drive.google.com/drive/folders/1WihGpV_QkRYPTqt9wCiXJCaTza0mssjo',
    'Project Finance Modeling 5: Depreciation, Tax & Financial Statements': 'https://drive.google.com/drive/folders/1_SW3si6RFa9dbyDdbSMRkZhQDpCaAJUf',
    'Project Finance Modeling 6: Bringing It All Together & Model Extensions': 'https://drive.google.com/drive/folders/1tEG6dpRKBfsQUPSe55o89GFMEM6-UcZJ',
    'REIT Modeling': 'https://drive.google.com/drive/folders/1p5qmr_ycnxMJ7-Qkl6X2kk7xC-5V1CE9',
    'Real Estate Financial Modeling': 'https://drive.google.com/drive/folders/12jYrjyA20TUkYMU-bW6TuDwkFMJJDjbz',
    'Real Estate Modeling 1: Introduction': 'https://drive.google.com/drive/folders/1xrydspW7mHvSgdTO8hTX1dRDipjbKKNA',
    'Real Estate Modeling 2: Operating Cash Flow': 'https://drive.google.com/drive/folders/1W1XdNEDpzL-vWwaqMtNOIUzl15zjaP7V',
    'Real Estate Modeling 3: Non-Operating Cash Flow': 'https://drive.google.com/drive/folders/1P24m4yAVMQXdyG8akuwhri7WOy1bWexZ',
    'Real Estate Modeling 4: Debt & Levered Cash Flow': 'https://drive.google.com/drive/folders/1m207ozLTUsaYuKTHGelY1Qlo-iLT_ZGP',
    'Real Estate Modeling 5: Joint Ventures & Waterfalls': 'https://drive.google.com/drive/folders/1jMOz6ua7-IF6BaOC9aNWISV2lUiJOjx5',
    'Real Estate Modeling 6: Summarizing & Analyzing the Model': 'https://drive.google.com/drive/folders/16LTEW6BxdhMkHuXdXILv_qSIkR8mqEkg',
    'Real Estate Modeling 7: Development Modeling': 'https://drive.google.com/drive/folders/1dg8vLF1Qp4-I6mL8NRRmbZW5RPXIXHqg',
    'Real Estate Modeling 8: Office Building Acquisition Case Study': 'https://drive.google.com/drive/folders/1MbPMUvD_RK1UN6e1Uz3SHzZK6dUiqqfG',
    'Real Estate Modeling 9: Multifamily Building Development Case Study': 'https://drive.google.com/drive/folders/1DiFr1orMqfa1aMZCIz2ydsp2zXzMcYez',
    'Restructuring Modeling': 'https://drive.google.com/drive/folders/1_a8g3QBGjfrib16neKdLPsNRlmCcuPae',
    'Sell-Side Equity Research Substitution (ERC)': 'https://drive.google.com/drive/folders/1n_ISC6Ct6RIJACeEqtsAo8VCqF1r1GVV',
    'Skills for Negotiating Transactions': 'https://drive.google.com/drive/folders/1is-aFvhtJgXa62kN3SAveIwJE5wt3GNx',
    'The 13-Week Cash Flow Model': 'https://drive.google.com/drive/folders/1Xajo7Zjlt1LYury4b6-t9j71mZ14aNGQ',
    'The Impact of Tax Reform on Financial Models': 'https://drive.google.com/drive/folders/1S4DspPkgtz1JUZjxVzYDRl2H__CLzSAP',
    'The Private Equity Deal Process': 'https://drive.google.com/drive/folders/10BYO4L5NF_T_BJWw_0Fk9v_nIrEwWNri',
    'The Ultimate Excel VBA Course': 'https://drive.google.com/drive/folders/1jStotxkRO-lcoAjrZmB3KxxQPJmcZwWR',
    'The Ultimate Project Finance Modeling Package': 'https://drive.google.com/drive/folders/1j6DAo3e25a54HZNgCUFfiI4wdcKo-mIp',
    'Trading Comps Modeling': 'https://drive.google.com/drive/folders/1egD3E7QQP8AsdWq-gcISzUH0BgWkZYQB',
    'Transaction Comps Modeling': 'https://drive.google.com/drive/folders/1KgGnc4a1eNo3R6Wh_BISYkMZYg3BypjF',
    'US GAAP and IFRS: Financial Reporting Differences in a Global Economy': 'https://drive.google.com/drive/folders/1cS3DCe7kwOqL5gy9ja_uDgRYBlbuS8tY',
    'Ultimate Guide to the Technical Finance Interview': 'https://drive.google.com/drive/folders/1JdXDS34XOEcOVNZgzs_GAE-ixFZ6Iq9R',
    'Understanding Asset v Stock Sales': 'https://drive.google.com/drive/folders/1aK5aQAl_Z-ztmYkyjkKUeG9Sy9EqD4bn',
    'Understanding Corporate Restructuring': 'https://drive.google.com/drive/folders/1p9Y48ylHOgRIhBbVrkOScHe2AKS7rgOM',
    'Understanding Divestitures': 'https://drive.google.com/drive/folders/1etW0j4x_IzIIpEPBLDfz30ieXdcMBPXm',
    'Understanding E&P Hedging Techniques and How to Model Them': 'https://drive.google.com/drive/folders/1wvOK5cJLsvyVmL77L1F1fdzIad3INgla',
    'Understanding Insurance Technology (InsurTech)': 'https://drive.google.com/drive/folders/15jTIVfciZh2ZaEB97efDDhXKb_YB-W2T',
    'Understanding MLPs': 'https://drive.google.com/drive/folders/1cQlW_fAdl7IGcUbGTGsJD5c8osUHwZlL',
    'Understanding Purchase Price Allocation': 'https://drive.google.com/drive/folders/1IK7bID43ptC8E742V2eJ62MwxKs9sRdW',
    'VC 1: Introduction & History of Venture Capital': 'https://drive.google.com/drive/folders/1LVbJiglUymSjqA-wtR-mngUu6zWipiDn',
    'VC 2: Developing an Investment Thesis': 'https://drive.google.com/drive/folders/1_JkD3O9K7XdihzngBzmySJelhtaEE2hj',
    'VC 3: Sourcing Early-Stage Deals': 'https://drive.google.com/drive/folders/15xEVPrVWaTo4aXbTpOH6oJ2biiiaxdlA',
    'VC 4: Structuring a Venture Deal': 'https://drive.google.com/drive/folders/1NjPwqb1tx8AlUOBvdR9M7NBqQ_jP4-9Q',
    'VC 5: Venture Fund Strategy': 'https://drive.google.com/drive/folders/1kQOD-91KrPzV_ojjwDW2Z99XJonx8JaS',
    'VC 6: Post-Investment Involvement & Exits': 'https://drive.google.com/drive/folders/1FJ-R74cvVOZjDjTNGCA6bcQz_ZKMijrf',
    'VC 7: Getting a Job in Venture Capital': 'https://drive.google.com/drive/folders/1GZQtn6YAx0Nfw0K91FMeXk2BpWqxrO0C',
    'VC Investor and Founder Dynamics': 'https://drive.google.com/drive/folders/1VhudxLmznL2T1efRsit7UXpeRaoMJjZB',
    'Wall Street Prep Premium Package': 'https://drive.google.com/drive/folders/1mfFuz7UCs3loMDpI0C3qJcvblh4FsHvk',
}

function getDriveLink(title) {
    if (DRIVE_LINKS[title]) return DRIVE_LINKS[title];
    const lower = title.toLowerCase();
    for (const [key, url] of Object.entries(DRIVE_LINKS)) {
        if (key.toLowerCase() === lower) return url;
    }
    return '';
}

// ── Bundle Data ─────────────────────────────────────────────
// Maps bundle names to their sub-courses and metadata.
const BUNDLE_DATA = {
    'Wall Street Prep Premium Package': {
        courseCount: '6 Courses', hours: '50+ Hours',
        courses: [
            'Financial Statement Modeling', 'DCF Modeling', 'M&A Modeling',
            'Trading Comps Modeling', 'Transaction Comps Modeling', 'LBO Modeling',
        ],
    },
    'Real Estate Financial Modeling': {
        courseCount: '9 Courses', hours: '18+ Hours',
        courses: [
            'Real Estate Modeling 1: Introduction',
            'Real Estate Modeling 2: Operating Cash Flow',
            'Real Estate Modeling 3: Non-Operating Cash Flow',
            'Real Estate Modeling 4: Debt & Levered Cash Flow',
            'Real Estate Modeling 5: Joint Ventures & Waterfalls',
            'Real Estate Modeling 6: Summarizing & Analyzing the Model',
            'Real Estate Modeling 7: Development Modeling',
            'Real Estate Modeling 8: Office Building Acquisition Case Study',
            'Real Estate Modeling 9: Multifamily Building Development Case Study',
        ],
    },
    'The Ultimate Project Finance Modeling Package': {
        courseCount: '6 Courses', hours: '18+ Hours',
        courses: [
            'Project Finance Modeling 1: Boot Module and Case Study',
            'Project Finance Modeling 2: Excel DNA for Modelers',
            'Project Finance Modeling 3: Blueprint of the Model',
            'Project Finance Modeling 4: Advanced Debt & Equity',
            'Project Finance Modeling 5: Depreciation, Tax & Financial Statements',
            'Project Finance Modeling 6: Bringing It All Together & Model Extensions',
        ],
    },
    'Private Equity Masterclass': {
        courseCount: '3 Courses', hours: '27+ Hours',
        courses: [
            'LBO Modeling', 'The Private Equity Deal Process',
            'LBO Modeling in the Lower Middle Market',
        ],
    },
    'Sell-Side Equity Research Certification (ERC©)': {
        courseCount: '9 Courses', hours: '26+ Hours',
        courses: [
            'ERC© 1: Equity Research Process',
            'ERC© 2: Financial Statement Analysis',
            'ERC© 3: Thesis and Due Diligence',
            'ERC© 4: Writing Research Reports',
            'ERC© 5: Financial Statement Modeling',
            'ERC© 6: Relative Valuation',
            'ERC© 7: Intrinsic Valuation',
            'ERC© 8: Professional Soft Skills',
            'ERC© Bonus: Breaking Into Research',
        ],
    },
    'Certification in FP&A Modeling (CFPAM™)': {
        courseCount: '8 Courses', hours: '28+ Hours',
        courses: [
            'CFPAM™ 1: An Introduction to FP&A',
            'CFPAM™ 2: Building the Operating Model – The Income Statement',
            'CFPAM™ 3: Building the Operating Model – The Balance Sheet',
            'CFPAM™ 4: Building the Operating Model – The Cash Flow Statement',
            'CFPAM™ 5: Pulling Together the Operating Model',
            'CFPAM™ 6: Project Management, Long-Range Planning & Analysis',
            'CFPAM™ 7: Presentation Best Practices & Building Dashboards',
            'CFPAM™ Appendix: Corporate Finance Principles',
        ],
    },
    'Venture Capital Masterclass': {
        courseCount: '7 Courses', hours: '13+ Hours',
        courses: [
            'VC 1: Introduction & History of Venture Capital',
            'VC 2: Developing an Investment Thesis',
            'VC 3: Sourcing Early-Stage Deals',
            'VC 4: Structuring a Venture Deal',
            'VC 5: Venture Fund Strategy',
            'VC 6: Post-Investment Involvement & Exits',
            'VC 7: Getting a Job in Venture Capital',
        ],
    },
    'Equities Markets Certification Program (EMC©)': {
        courseCount: '7 Courses', hours: '10+ Hours',
        courses: [
            'EMC© 1: Cash Equities',
            'EMC© 2: Equity Valuation',
            'EMC© 3: Equity Indices, Asset Managers and ETFs',
            'EMC© 4: Equity Futures and Delta One',
            'EMC© 5: Hedge Fund Strategies',
            'EMC© 6: Securities Lending and Prime Brokerage',
            'ESG Investing, Green Bonds and Social Bonds',
        ],
    },
    'Fixed Income Markets Certification Program (FIMC©)': {
        courseCount: '8 Courses', hours: '13+ Hours',
        courses: [
            'FIMC© 1: Intro to Financial Markets',
            'FIMC© 2: Intro to Fixed Income Trading & Bonds',
            'FIMC© 3: Economics & Role of Central Bank',
            'FIMC© 4: Money Markets',
            'FIMC© 5: Government Bonds',
            'FIMC© 6: Corporate Bonds',
            'FIMC© 7: Mortgage Backed Securities',
            'ESG Investing, Green Bonds and Social Bonds',
        ],
    },
    'Wealth Management Certification': {
        courseCount: '11 Courses', hours: '17+ Hours',
        courses: [
            'WMC 01: Asset Allocation',
            'WMC 02: Investing Basics',
            'WMC 03: Mutual Funds and ETFs',
            'WMC 04: Intro to Options',
            'WMC 05: Intro to Bonds',
            'WMC 06: Credit Risk',
            'WMC 07: Investment Principles',
            'WMC 08: Intro to Portfolio Management',
            'WMC 09: Capital Asset Pricing Model',
            'WMC 10: Time Value of Money and Yield',
            'WMC 11: Financial Insights: Cash Flow Analysis, Economic Profit and Ratio Analysis',
        ],
    },
};

/**
 * Builds the HTML for an expandable bundle tile.
 * @param {Course} course – the parsed bundle entry
 * @param {number} index – 1-based index
 * @returns {string}
 */
function buildBundleCardHTML(course, index) {
    const bundle = BUNDLE_DATA[course.title];
    if (!bundle) {
        // Fallback: render as a normal card if no bundle data found
        return buildCardHTML(course, false);
    }

    const bundleDriveUrl = getDriveLink(course.title);
    const courseListHTML = bundle.courses.map((name, i) => {
        const url = getDriveLink(name);
        const tag = url ? 'a' : 'span';
        const attrs = url ? `href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer"` : '';
        const linkClass = url ? ' bundle-course-linked' : '';
        return `
      <${tag} class="bundle-course-item${linkClass}" ${attrs}>
        <span class="bundle-course-num">${i + 1}</span>
        <span class="bundle-course-name">${escapeHtml(name)}</span>
        ${url ? '<span class="bundle-course-icon">↗</span>' : ''}
      </${tag}>`;
    }).join('');

    return `
    <article class="bundle-card" data-title="${escapeAttr(course.title)}">
      <div class="bundle-card-header" role="button" tabindex="0" aria-expanded="false">
        <div class="bundle-card-info">
          <span class="bundle-card-number">${index}</span>
          <h3 class="bundle-card-title">${escapeHtml(course.title)}</h3>
          <div class="bundle-card-meta">
            <span class="chip chip-bundle-count">
              <span class="chip-icon">📦</span>
              ${bundle.courseCount}
            </span>
            <span class="chip chip-bundle-hours">
              <span class="chip-icon">⏱</span>
              ${bundle.hours}
            </span>
            ${bundleDriveUrl ? `<a href="${escapeAttr(bundleDriveUrl)}" target="_blank" rel="noopener noreferrer" class="chip chip-bundle-drive" onclick="event.stopPropagation()">
              <span class="chip-icon">📁</span>
              Full Bundle
            </a>` : ''}
          </div>
        </div>
        <span class="bundle-card-chevron">▾</span>
      </div>
      <div class="bundle-card-courses">
        ${courseListHTML}
      </div>
    </article>
  `;
}


// ── Course Data Model ───────────────────────────────────────
/**
 * @typedef {Object} Course
 * @property {string}  title        – Course title without leading number
 * @property {string}  duration     – e.g. "6h 58m", or '' if not available
 * @property {string}  lessons      – e.g. "54 Lessons + Exam", or ''
 * @property {boolean} hasExam      – true if course includes an exam
 * @property {number}  lessonCount  – numeric count of lessons (0 if unknown)
 * @property {string}  category     – parent category name
 * @property {number}  index        – 1-based index within category

 *
 * ── Future extension fields (add as needed): ──
 * @property {string}  [filePath]   – local path to course files
 * @property {string}  [thumbnail]  – URL or path to thumbnail image
 * @property {string[]} [tags]      – searchable tags
 * @property {boolean} [completed]  – completion state (persist in localStorage)
 * @property {number}  [progress]   – 0-100 progress percentage
 */

// ── DOM References ──────────────────────────────────────────
const DOM = {
    sidebarNav: () => document.getElementById('sidebar-nav'),
    cardGrid: () => document.getElementById('card-grid'),
    searchInput: () => document.getElementById('search-input'),
    searchClear: () => document.getElementById('search-clear'),
    sortBtn: () => document.getElementById('sort-btn'),
    categoryTitle: () => document.getElementById('category-title'),
    categoryDesc: () => document.getElementById('category-desc'),
    resultsCount: () => document.getElementById('results-count'),
    themeToggle: () => document.getElementById('theme-toggle'),
    sidebar: () => document.getElementById('sidebar'),
    sidebarOverlay: () => document.getElementById('sidebar-overlay'),
    mobileMenuBtn: () => document.getElementById('mobile-menu-btn'),
    statsTotal: () => document.getElementById('stats-total'),
    statsCats: () => document.getElementById('stats-cats'),
};

// ============================================================
// PARSER – Converts raw TXT catalog into structured data
// ============================================================

/**
 * Parses the raw course catalog text into categories and courses.
 *
 * Format expectations:
 *   CATEGORY NAME          ← all-caps line (category header)
 *   (blank line)
 *   1.  Course Title | Duration | Lessons
 *   2.  Another Course | Duration | Lessons
 *   (blank line)
 *   NEXT CATEGORY
 *
 * Multi-line entries are NOT expected in the cleaned file.
 * Courses may omit duration and/or lessons.
 *
 * @param {string} raw – raw text content of courses.txt
 * @returns {{ name: string, courses: Course[] }[]}
 */
function parseCatalog(raw) {
    const lines = raw.split('\n');
    const categories = [];
    let currentCategory = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip blank lines
        if (!line) continue;

        // ── Detect category header ──
        // A line is a category header if it is ALL CAPS (letters, digits,
        // spaces, ampersands, and punctuation — but no lowercase letters)
        // and does NOT start with a digit (which would be a course line).
        if (isCategoryHeader(line)) {
            currentCategory = { name: formatCategoryName(line), courses: [] };
            categories.push(currentCategory);
            continue;
        }

        // ── Parse course line ──
        if (currentCategory) {
            const course = parseCourseLine(line, currentCategory.name, currentCategory.courses.length + 1);
            if (course) {
                currentCategory.courses.push(course);
            }
        }
    }

    return categories;
}

/**
 * Checks if a line is a category header.
 * Category headers are ALL-CAPS with no leading digit.
 */
function isCategoryHeader(line) {
    // Must not start with a digit (course lines start with numbers)
    if (/^\d/.test(line)) return false;
    // Must contain at least 2 alphabetic characters
    if ((line.match(/[A-Za-z]/g) || []).length < 2) return false;
    // Must not contain any lowercase letters
    if (/[a-z]/.test(line)) return false;
    return true;
}

/**
 * Formats a category name from ALL CAPS to Title Case.
 * Preserves special tokens like "FP&A", "AI", etc.
 */
function formatCategoryName(raw) {
    // Keep the original casing for the category name as-is (already all-caps in source)
    // We'll display it with proper casing
    const specialTokens = {
        'FP&A': 'FP&A',
        'AI': 'AI',
        'EXCEL AND POWERPOINT': 'Excel & PowerPoint',
        'DATA ANALYSIS & AI': 'Data Analysis & AI',
        'MERGERS & ACQUISITIONS': 'Mergers & Acquisitions',
    };

    if (specialTokens[raw]) return specialTokens[raw];

    // General Title Case conversion
    return raw.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase())
        .replace(/\bAnd\b/g, '&');
}

/**
 * Parses a single course line.
 *
 * Expected formats:
 *   "1.  Course Title | 6h 58m | 54 Lessons + Exam"
 *   "8.  IB Soft Skills: Tools for Becoming an Amazing Junior Banker"
 *   "1.  Bank and FIG Modeling | n/a | 0 Lessons"
 *
 * @param {string} line
 * @param {string} categoryName
 * @param {number} fallbackIndex
 * @returns {Course|null}
 */
function parseCourseLine(line, categoryName, fallbackIndex) {
    // Remove leading number + dot: "1.  " or "10. "
    const numberMatch = line.match(/^(\d+)\.\s+/);
    if (!numberMatch) return null; // Not a course line

    const index = parseInt(numberMatch[1], 10);
    const rest = line.slice(numberMatch[0].length);

    // Split by pipe
    const parts = rest.split('|').map(s => s.trim());

    const title = parts[0] || '';
    let duration = parts[1] || '';
    let lessonsRaw = parts[2] || '';

    // Clean up duration
    if (duration.toLowerCase() === 'n/a' || duration === '0' || duration === '') {
        duration = '';
    }

    // Parse lesson count and exam flag
    let lessonCount = 0;
    let hasExam = false;
    if (lessonsRaw) {
        const lessonMatch = lessonsRaw.match(/(\d+)\s*Lessons?/i);
        if (lessonMatch) {
            lessonCount = parseInt(lessonMatch[1], 10);
        }
        hasExam = /exam/i.test(lessonsRaw);
    }

    // Build formatted lessons string
    let lessons = '';
    if (lessonCount > 0) {
        lessons = `${lessonCount} Lesson${lessonCount !== 1 ? 's' : ''}`;
    }

    return {
        title,
        duration,
        lessons,
        hasExam,
        lessonCount,
        category: categoryName,
        index,
        driveUrl: getDriveLink(title),
    };
}

// ============================================================
// FILTER PIPELINE
// ============================================================

/**
 * Returns filtered and sorted courses based on current state.
 * This is the single pipeline that drives all rendering.
 *
 * Extension point: add more filter stages here (e.g., duration range,
 * tags, completion status).
 *
 * @returns {Course[]}
 */
function getFilteredCourses() {
    let courses = [];

    // Stage 1: Category filter
    if (state.activeCategory === 'all') {
        state.categories.forEach(cat => {
            courses = courses.concat(cat.courses);
        });
    } else {
        const cat = state.categories.find(c => c.name === state.activeCategory);
        if (cat) courses = [...cat.courses];
    }

    // Stage 2: Search filter
    if (state.searchQuery) {
        const q = state.searchQuery;
        courses = courses.filter(c =>
            c.title.toLowerCase().includes(q) ||
            c.category.toLowerCase().includes(q)
        );
    }

    // Stage 3: Sort
    courses.sort((a, b) => {
        const cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
        return state.sortDir === 'asc' ? cmp : -cmp;
    });

    return courses;
}

// ============================================================
// RENDERER – Builds all UI from state
// ============================================================

/**
 * Renders the sidebar category navigation.
 */
function renderSidebar() {
    const nav = DOM.sidebarNav();
    if (!nav) return;

    // Count total courses
    const totalCount = state.categories.reduce((sum, cat) => sum + cat.courses.length, 0);

    let html = '';

    // "All Courses" item
    html += `
    <button class="sidebar-item${state.activeCategory === 'all' ? ' active' : ''}"
            data-category="all"
            aria-current="${state.activeCategory === 'all' ? 'true' : 'false'}">
      <span class="sidebar-item-name">All Courses</span>
      <span class="sidebar-item-count">${totalCount}</span>
    </button>
  `;

    // Bundles item (at the top, distinct)
    const bundlesCat = state.categories.find(c => c.name === 'Bundles');
    if (bundlesCat) {
        const isActive = state.activeCategory === bundlesCat.name;
        html += `
      <button class="sidebar-item sidebar-item-bundle${isActive ? ' active' : ''}"
              data-category="${escapeAttr(bundlesCat.name)}"
              aria-current="${isActive ? 'true' : 'false'}">
        <span class="sidebar-item-name">📦 Bundles</span>
        <span class="sidebar-item-count">${bundlesCat.courses.length}</span>
      </button>
      <div class="sidebar-separator"></div>
    `;
    }

    // Category items (excluding Bundles)
    state.categories.forEach(cat => {
        if (cat.name === 'Bundles') return; // already rendered above
        const isActive = state.activeCategory === cat.name;
        html += `
      <button class="sidebar-item${isActive ? ' active' : ''}"
              data-category="${escapeAttr(cat.name)}"
              aria-current="${isActive ? 'true' : 'false'}">
        <span class="sidebar-item-name">${escapeHtml(cat.name)}</span>
        <span class="sidebar-item-count">${cat.courses.length}</span>
      </button>
    `;
    });

    nav.innerHTML = html;

    // Update stats
    const statsTotal = DOM.statsTotal();
    const statsCats = DOM.statsCats();
    if (statsTotal) statsTotal.textContent = totalCount;
    if (statsCats) statsCats.textContent = state.categories.length;
}

/**
 * Renders course cards into the grid.
 */
function renderCards() {
    const grid = DOM.cardGrid();
    if (!grid) return;

    const courses = getFilteredCourses();

    // Update results count
    const resultsEl = DOM.resultsCount();
    if (resultsEl) {
        resultsEl.textContent = `${courses.length} course${courses.length !== 1 ? 's' : ''}`;
    }

    // Update category banner
    const titleEl = DOM.categoryTitle();
    const descEl = DOM.categoryDesc();
    if (titleEl) {
        titleEl.textContent = state.activeCategory === 'all' ? 'All Courses' : state.activeCategory;
    }
    if (descEl) {
        if (state.searchQuery) {
            descEl.textContent = `Showing results for "${state.searchQuery}"`;
        } else if (state.activeCategory === 'all') {
            descEl.textContent = `Browse the complete catalog across ${state.categories.length} categories`;
        } else {
            const cat = state.categories.find(c => c.name === state.activeCategory);
            descEl.textContent = cat ? `${cat.courses.length} courses in this category` : '';
        }
    }

    // Empty state
    if (courses.length === 0) {
        grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🔍</div>
        <h2>No courses found</h2>
        <p>${state.searchQuery
                ? 'Try adjusting your search terms or selecting a different category.'
                : 'This category doesn\'t have any courses yet.'
            }</p>
      </div>
    `;
        return;
    }

    // Build cards
    let html = '';
    courses.forEach((course, i) => {
        const showCategory = state.activeCategory === 'all' || !!state.searchQuery;
        // Use bundle rendering for courses in the BUNDLES category
        if (course.category === 'Bundles' && BUNDLE_DATA[course.title]) {
            html += buildBundleCardHTML(course, course.index);
        } else {
            html += buildCardHTML(course, showCategory);
        }
    });

    grid.innerHTML = html;
}

/**
 * Builds the HTML string for a single course card.
 *
 * Extension point: Add thumbnail, click handler, progress bar,
 * tags, or completion checkbox here.
 *
 * @param {Course} course
 * @param {boolean} showCategory – whether to show the category label
 * @returns {string}
 */
function buildCardHTML(course, showCategory) {
    const titleHTML = state.searchQuery
        ? highlightMatch(escapeHtml(course.title), state.searchQuery)
        : escapeHtml(course.title);

    let metaChips = '';

    // Duration chip (hidden if blank or n/a)
    if (course.duration) {
        metaChips += `
      <span class="chip chip-duration">
        <span class="chip-icon">⏱</span>
        ${escapeHtml(course.duration)}
      </span>
    `;
    }

    // Lessons chip (hidden if 0 or blank)
    if (course.lessons) {
        metaChips += `
      <span class="chip chip-lessons">
        <span class="chip-icon">📚</span>
        ${escapeHtml(course.lessons)}
      </span>
    `;
    }

    // Exam chip
    if (course.hasExam) {
        metaChips += `
      <span class="chip chip-exam">
        <span class="chip-icon">✎</span>
        Exam
      </span>
    `;
    }

    const tag = course.driveUrl ? 'a' : 'article';
    const linkAttrs = course.driveUrl
        ? `href="${escapeAttr(course.driveUrl)}" target="_blank" rel="noopener noreferrer"`
        : '';
    const linkedClass = course.driveUrl ? ' course-card-linked' : '';

    return `
    <${tag} class="course-card${linkedClass}" data-title="${escapeAttr(course.title)}" ${linkAttrs}>
      <span class="course-card-number">${course.index}</span>
      ${showCategory ? `<div class="course-card-category">${escapeHtml(course.category)}</div>` : ''}
      <h3 class="course-card-title">${titleHTML}</h3>
      ${metaChips ? `<div class="course-card-meta">${metaChips}</div>` : ''}
      ${course.driveUrl ? '<span class="course-card-link-icon" title="Open in Google Drive">↗</span>' : ''}
    </${tag}>
  `;
}

/**
 * Highlights occurrences of `query` in `text` using <mark> tags.
 * @param {string} text – already HTML-escaped text
 * @param {string} query – lowercase search query
 * @returns {string}
 */
function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// ============================================================
// EVENT HANDLERS
// ============================================================

/**
 * Initializes all event listeners.
 */
function initEvents() {
    // ── Sidebar category click ──
    DOM.sidebarNav()?.addEventListener('click', (e) => {
        const btn = e.target.closest('.sidebar-item');
        if (!btn) return;
        const category = btn.dataset.category;
        state.activeCategory = category;
        renderSidebar();
        renderCards();
        closeMobileSidebar();
    });

    // ── Bundle card expand/collapse ──
    DOM.cardGrid()?.addEventListener('click', (e) => {
        const header = e.target.closest('.bundle-card-header');
        if (!header) return;
        // Don't toggle if clicking a link inside the header (e.g. Full Bundle chip)
        if (e.target.closest('a')) return;
        const card = header.closest('.bundle-card');
        if (!card) return;
        const isExpanded = card.classList.toggle('expanded');
        header.setAttribute('aria-expanded', isExpanded);
    });

    // Keyboard support for bundle headers
    DOM.cardGrid()?.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const header = e.target.closest('.bundle-card-header');
        if (!header) return;
        e.preventDefault();
        header.click();
    });

    // ── Search input ──
    const searchInput = DOM.searchInput();
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                state.searchQuery = searchInput.value.trim().toLowerCase();

                // Show/hide clear button
                const clearBtn = DOM.searchClear();
                if (clearBtn) {
                    clearBtn.classList.toggle('visible', searchInput.value.length > 0);
                }

                // When searching, show results across all categories
                if (state.searchQuery && state.activeCategory !== 'all') {
                    state.activeCategory = 'all';
                    renderSidebar();
                }

                renderCards();
            }, 120); // Debounce for smooth feel
        });
    }

    // ── Search clear ──
    DOM.searchClear()?.addEventListener('click', () => {
        const searchInput = DOM.searchInput();
        if (searchInput) {
            searchInput.value = '';
            state.searchQuery = '';
            DOM.searchClear()?.classList.remove('visible');
            renderCards();
            searchInput.focus();
        }
    });

    // ── Sort toggle ──
    DOM.sortBtn()?.addEventListener('click', () => {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        const btn = DOM.sortBtn();
        if (btn) {
            btn.dataset.dir = state.sortDir;
            btn.querySelector('span:not(.sort-icon)').textContent =
                state.sortDir === 'asc' ? 'A → Z' : 'Z → A';
        }
        renderCards();
    });

    // ── Theme toggle ──
    DOM.themeToggle()?.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeToggleLabel(newTheme);
    });

    // ── Mobile menu ──
    DOM.mobileMenuBtn()?.addEventListener('click', openMobileSidebar);
    DOM.sidebarOverlay()?.addEventListener('click', closeMobileSidebar);

    // ── Keyboard shortcut: Cmd/Ctrl + K to focus search ──
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            DOM.searchInput()?.focus();
        }
        // Escape to close sidebar or clear search
        if (e.key === 'Escape') {
            closeMobileSidebar();
            const searchInput = DOM.searchInput();
            if (searchInput && document.activeElement === searchInput && searchInput.value) {
                searchInput.value = '';
                state.searchQuery = '';
                DOM.searchClear()?.classList.remove('visible');
                renderCards();
            }
        }
    });
}

function openMobileSidebar() {
    DOM.sidebar()?.classList.add('open');
    DOM.sidebarOverlay()?.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
    DOM.sidebar()?.classList.remove('open');
    DOM.sidebarOverlay()?.classList.remove('open');
    document.body.style.overflow = '';
}

function updateThemeToggleLabel(theme) {
    const label = document.querySelector('.theme-toggle-label span:last-child');
    if (label) {
        label.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
    }
    const icon = document.querySelector('.theme-toggle-label span:first-child');
    if (icon) {
        icon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
}

// ============================================================
// UTILITIES
// ============================================================

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// AUTHENTICATION – Client-side password gate
// ============================================================

/**
 * SHA-256 hash of the access password.
 *
 * ── HOW TO CHANGE THE PASSWORD ──
 * 1. Open browser console
 * 2. Run: crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR_NEW_PASSWORD')).then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('')))
 * 3. Copy the hash output and replace the PASSWORD_HASH string below
 *
 * Current password: "coursedashboard"
 */
const PASSWORD_HASH = '05a181f00c157f70413d33701778a6ee7d2747ac18b9c0fbb8bd71a62dd7a223';

/**
 * Computes the SHA-256 hex digest of a string.
 * @param {string} str
 * @returns {Promise<string>}
 */
async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Checks if the user is already authenticated in this session.
 */
function isAuthenticated() {
    return sessionStorage.getItem('cd_auth') === '1';
}

/**
 * Marks the user as authenticated for this session.
 */
function setAuthenticated() {
    sessionStorage.setItem('cd_auth', '1');
}

/**
 * Validates the entered password against the stored hash.
 * @param {string} password
 * @returns {Promise<boolean>}
 */
async function validatePassword(password) {
    const hash = await sha256(password);
    return hash === PASSWORD_HASH;
}

/**
 * Initializes the auth gate listeners.
 */
function initAuth() {
    const overlay = document.getElementById('auth-overlay');
    const form = document.getElementById('auth-form');
    const input = document.getElementById('auth-password');
    const errorEl = document.getElementById('auth-error');
    const toggleVis = document.getElementById('auth-toggle-vis');
    const app = document.getElementById('app');

    // Toggle password visibility
    toggleVis?.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        toggleVis.textContent = isPassword ? '🙈' : '👁';
        input.focus();
    });

    // Form submit
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = input.value;
        if (!password) return;

        const valid = await validatePassword(password);
        if (valid) {
            setAuthenticated();
            overlay.classList.add('hidden');
            app.style.display = '';
            // Now load the dashboard
            await loadDashboard();
        } else {
            errorEl.textContent = 'Incorrect password. Try again.';
            input.classList.add('error');
            input.value = '';
            input.focus();
            setTimeout(() => {
                input.classList.remove('error');
            }, 600);
        }
    });

    // Clear error on new input
    input?.addEventListener('input', () => {
        errorEl.textContent = '';
        input.classList.remove('error');
    });
}

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Loads and renders the course catalog.
 * Separated from init() so it can be called after authentication.
 */
async function loadDashboard() {
    try {
        const response = await fetch('./courses.txt');
        if (!response.ok) throw new Error(`Failed to load courses.txt (${response.status})`);
        const raw = await response.text();

        state.categories = parseCatalog(raw);
        state.totalCourses = state.categories.reduce((sum, cat) => sum + cat.courses.length, 0);

        renderSidebar();
        renderCards();
        initEvents();
    } catch (err) {
        console.error('CourseDashboard init error:', err);
        const grid = DOM.cardGrid();
        if (grid) {
            grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">⚠️</div>
          <h2>Unable to load courses</h2>
          <p>Make sure <code>courses.txt</code> is in the same folder as <code>index.html</code> and you're serving the site via a local server or a static host.</p>
        </div>
      `;
        }
    }
}

/**
 * Application entry point.
 * Checks auth state, shows login gate or loads dashboard.
 */
async function init() {
    // ── Restore saved theme ──
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeToggleLabel(savedTheme);
    } else {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
            updateThemeToggleLabel('dark');
        }
    }

    const overlay = document.getElementById('auth-overlay');
    const app = document.getElementById('app');

    if (isAuthenticated()) {
        // Already authenticated — skip login, show dashboard
        overlay.classList.add('hidden');
        app.style.display = '';
        await loadDashboard();
    } else {
        // Show login gate
        initAuth();
    }
}

// Boot!
document.addEventListener('DOMContentLoaded', init);


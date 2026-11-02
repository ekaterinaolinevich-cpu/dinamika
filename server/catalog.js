// Каталог показателей.
//
// Референсы здесь — ориентировочные (взрослые, небеременные). Настоящий референс
// всегда берётся из бланка лаборатории; каталог — только фолбэк.

export const PANELS = {
  cbc:          { title: 'Общий анализ крови', short: 'ОАК',         emoji: '🩸', color: '#E4572E' },
  iron:         { title: 'Железо',             short: 'Железо',      emoji: '🧲', color: '#A0714F' },
  biochem:      { title: 'Биохимия',           short: 'Биохимия',    emoji: '⚗️', color: '#3B82F6' },
  lipids:       { title: 'Липидный профиль',   short: 'Липиды',      emoji: '🫀', color: '#D946A0' },
  thyroid:      { title: 'Щитовидная железа',  short: 'Щитовидка',   emoji: '🦋', color: '#7C5CFF' },
  hormones:     { title: 'Гормоны',            short: 'Гормоны',     emoji: '⚡', color: '#F59E0B' },
  vitamins:     { title: 'Витамины',           short: 'Витамины',    emoji: '☀️', color: '#EAB308' },
  inflammation: { title: 'Воспаление',         short: 'Воспаление',  emoji: '🔥', color: '#EF4444' },
  electrolytes: { title: 'Минералы',           short: 'Минералы',    emoji: '💧', color: '#06B6D4' },
};

export const ORDER = ['cbc', 'iron', 'biochem', 'lipids', 'thyroid', 'hormones', 'vitamins', 'inflammation', 'electrolytes'];

const RAW = [
  // ---------- ОАК ----------
  { code: 'hemoglobin', name: 'Гемоглобин', unit: 'г/л', panel: 'cbc', f: [120, 150], m: [130, 170],
    syn: ['гемоглобин', 'hgb', 'hb', 'hemoglobin'],
    about: 'Красный пигмент крови, переносит кислород. Самый простой маркер анемии.',
    low: 'Ниже нормы — крови не хватает кислорода. Чаще всего это дефицит железа, но причины бывают разные. Нужен ОАК целиком и ферритин.',
    high: 'Выше нормы бывает при сгущении крови, нехватке жидкости или курении. Врач разберётся.' },

  { code: 'rbc', name: 'Эритроциты', unit: '×10¹²/л', panel: 'cbc', f: [3.8, 5.1], m: [4.3, 5.9],
    syn: ['эритроциты', 'rbc', 'red blood cells'],
    about: 'Клетки, которые переносят кислород. Смотрят вместе с гемоглобином и размером клеток (MCV).' },

  { code: 'hct', name: 'Гематокрит', unit: '%', panel: 'cbc', f: [35, 45], m: [39, 49],
    syn: ['гематокрит', 'hct', 'hematocrit'],
    about: 'Какая доля крови — это клетки, а какая — плазма. Помогает понять, сгущена ли кровь.' },

  { code: 'mcv', name: 'MCV (средний объём эритроцита)', unit: 'фл', panel: 'cbc', f: [80, 100], m: [80, 100],
    syn: ['mcv', 'средний объем эритроцита', 'средний объём эритроцитов'],
    about: 'Размер эритроцитов. Мелкие клетки — типичная картина при дефиците железа, крупные — при дефиците B12 или фолатов.' },

  { code: 'mch', name: 'MCH (гемоглобин в эритроците)', unit: 'пг', panel: 'cbc', f: [27, 34], m: [27, 34],
    syn: ['mch', 'среднее содержание гемоглобина'],
    about: 'Сколько гемоглобина в среднем приходится на одну клетку.' },

  { code: 'mchc', name: 'MCHC (концентрация гемоглобина)', unit: 'г/л', panel: 'cbc', f: [320, 360], m: [320, 360],
    syn: ['mchc', 'средняя концентрация гемоглобина'],
    about: 'Насыщенность эритроцитов гемоглобином.' },

  { code: 'plt', name: 'Тромбоциты', unit: '×10⁹/л', panel: 'cbc', f: [180, 320], m: [180, 320],
    syn: ['тромбоциты', 'plt', 'platelets'],
    about: 'Отвечают за свёртываемость крови. Низкие — риск кровотечений, высокие — риск тромбозов.' },

  { code: 'wbc', name: 'Лейкоциты', unit: '×10⁹/л', panel: 'cbc', f: [4.0, 9.0], m: [4.0, 9.0],
    syn: ['лейкоциты', 'wbc', 'white blood cells'],
    about: 'Клетки иммунитета. Растут при инфекции и воспалении, падают при вирусной нагрузке и некоторых лекарствах.' },

  { code: 'neutrophils', name: 'Нейтрофилы', unit: '%', panel: 'cbc', f: [47, 72], m: [47, 72],
    syn: ['нейтрофилы', 'neutrophils'],
    about: 'Главные «пожиратели» бактерий. Повышаются при бактериальной инфекции, стрессе, кортикостероидах.' },

  { code: 'lymphocytes', name: 'Лимфоциты', unit: '%', panel: 'cbc', f: [19, 37], m: [19, 37],
    syn: ['лимфоциты', 'lymphocytes'],
    about: 'Иммунные клетки, которые узнают вирусы и вырабатывают антитела.' },

  { code: 'monocytes', name: 'Моноциты', unit: '%', panel: 'cbc', f: [3, 11], m: [3, 11],
    syn: ['моноциты', 'monocytes'],
    about: 'Клетки, которые убирают «мусор» после воспаления.' },

  { code: 'eosinophils', name: 'Эозинофилы', unit: '%', panel: 'cbc', f: [0.5, 5], m: [0.5, 5],
    syn: ['эозинофилы', 'eosinophils'],
    about: 'Реагируют на аллергии и паразитов.' },

  { code: 'basophils', name: 'Базофилы', unit: '%', panel: 'cbc', f: [0, 1], m: [0, 1],
    syn: ['базофилы', 'basophils'],
    about: 'Самые редкие лейкоциты, связаны с аллергическими реакциями.' },

  { code: 'reticulocytes', name: 'Ретикулоциты', unit: '%', panel: 'cbc', f: [0.5, 2.2], m: [0.5, 2.2],
    syn: ['ретикулоциты', 'reticulocytes'],
    about: 'Молодые эритроциты. Показывают, как активно костный мозг производит новые клетки.' },

  // ---------- Железо ----------
  { code: 'ferritin', name: 'Ферритин', unit: 'нг/мл', panel: 'iron', f: [15, 150], m: [30, 400],
    syn: ['ферритин', 'ferritin', 'сывороточный ферритин'],
    about: 'Белок, в котором хранится железо. Показывает запасы, а не сиюминутное содержание железа в крови — поэтому информативнее.',
    low: 'Запасов железа мало. Частая причина — скрытая потеря крови или недостаток железа в еде. Даже при нормальном гемоглобине это повод провериться.',
    high: 'Запасы выше нормы. Бывает при избытке железа, воспалении, болезнях печени. Ферритин — ещё и белок острой фазы.' },

  { code: 'iron', name: 'Железо', unit: 'мкмоль/л', panel: 'iron', f: [9, 30], m: [12, 31],
    syn: ['железо', 'iron', 'железо сыворотки', 'сывороточное железо'],
    about: 'Железо в крови «здесь и сейчас». Сильно скачет в течение дня и после еды — смотрят вместе с ферритином.' },

  // ---------- Биохимия ----------
  { code: 'glucose', name: 'Глюкоза', unit: 'ммоль/л', panel: 'biochem', f: [3.9, 6.1], m: [3.9, 6.1],
    syn: ['глюкоза', 'glucose', 'сахар', 'глюкоза натощак'],
    about: 'Сахар в крови натощак. Ключевой показатель углеводного обмена.',
    high: 'Выше нормы. Разовое повышение бывает от стресса и еды, стойкое — повод проверить HbA1c.',
    low: 'Ниже нормы — бывает при голоде и ошибках приёма препаратов. Сопровождается слабостью и дрожью.' },

  { code: 'hba1c', name: 'HbA1c (гликированный гемоглобин)', unit: '%', panel: 'biochem', f: [4.0, 5.6], m: [4.0, 5.6],
    syn: ['hba1c', 'гликированный гемоглобин', 'гликозилированный гемоглобин'],
    about: 'Показывает средний сахар за последние 2–3 месяца. Не зависит от того, что ты съела вчера.',
    high: 'Выше нормы — сахар был повышен длительное время. Главный маркер преддиабета и диабета.' },

  { code: 'creatinine', name: 'Креатинин', unit: 'мкмоль/л', panel: 'biochem', f: [53, 97], m: [62, 106],
    syn: ['креатинин', 'creatinine'],
    about: 'Продукт обмена мышц, выводится почками. Основной маркер работы почек.',
    high: 'Выше нормы — почки хуже фильтруют. Но влияет и мышечная масса: у спортсменов креатинин часто повышен без болезни.' },

  { code: 'urea', name: 'Мочевина', unit: 'ммоль/л', panel: 'biochem', f: [2.5, 8.3], m: [2.5, 8.3],
    syn: ['мочевина', 'urea'],
    about: 'Ещё один показатель работы почек и белкового обмена.' },

  { code: 'uric_acid', name: 'Мочевая кислота', unit: 'мкмоль/л', panel: 'biochem', f: [150, 350], m: [210, 420],
    syn: ['мочевая кислота', 'uric acid'],
    about: 'Конечный продукт обмена пуринов. Повышение связано с подагрой и камнями в почках.' },

  { code: 'alt', name: 'АЛТ', unit: 'Ед/л', panel: 'biochem', f: [0, 31], m: [0, 41], openLow: true,
    syn: ['алт', 'alt', 'аланинаминотрансфераза'],
    about: 'Фермент печени. Растёт, когда клетки печени повреждаются.',
    high: 'Выше нормы — печень «сигналит». Причины: жирная печень, алкоголь, лекарства, вирусы. Повторяют через 2–4 недели.' },

  { code: 'ast', name: 'АСТ', unit: 'Ед/л', panel: 'biochem', f: [0, 31], m: [0, 37], openLow: true,
    syn: ['аст', 'ast', 'аспартатаминотрансфераза'],
    about: 'Фермент печени и мышц. Смотрят в паре с АЛТ.' },

  { code: 'ggt', name: 'ГГТ', unit: 'Ед/л', panel: 'biochem', f: [0, 32], m: [0, 49], openLow: true,
    syn: ['ггт', 'ggt', 'гамма-глутамилтрансфераза'],
    about: 'Чувствительный маркер печени и желчных путей, реагирует на алкоголь.' },

  { code: 'alp', name: 'Щелочная фосфатаза', unit: 'Ед/л', panel: 'biochem', f: [35, 104], m: [40, 129],
    syn: ['щелочная фосфатаза', 'alp', 'щф'],
    about: 'Фермент печени и костей. У подростков и беременных бывает выше нормы — это нормально.' },

  { code: 'bilirubin_total', name: 'Билирубин общий', unit: 'мкмоль/л', panel: 'biochem', f: [3.4, 20.5], m: [3.4, 20.5],
    syn: ['билирубин общий', 'bilirubin total', 'билирубин'],
    about: 'Продукт распада гемоглобина. Повышение даёт желтушность и указывает на печень или желчный.' },

  { code: 'bilirubin_direct', name: 'Билирубин прямой', unit: 'мкмоль/л', panel: 'biochem', f: [0, 5], m: [0, 5], openLow: true,
    syn: ['билирубин прямой', 'bilirubin direct', 'связанный билирубин'],
    about: '«Связанная» фракция билирубина — помогает понять, где проблема: в печени или в желчных путях.' },

  { code: 'total_protein', name: 'Общий белок', unit: 'г/л', panel: 'biochem', f: [64, 83], m: [64, 83],
    syn: ['общий белок', 'total protein', 'белок общий'],
    about: 'Сумма всех белков крови. Общий ориентир по питанию и работе печени.' },

  { code: 'albumin', name: 'Альбумин', unit: 'г/л', panel: 'biochem', f: [35, 52], m: [35, 52],
    syn: ['альбумин', 'albumin'],
    about: 'Основной белок плазмы. Падает при воспалении, проблемах с печенью и почками.' },

  { code: 'amylase', name: 'Амилаза', unit: 'Ед/л', panel: 'biochem', f: [28, 100], m: [28, 100],
    syn: ['амилаза', 'amylase', 'альфа-амилаза'],
    about: 'Фермент поджелудочной железы и слюнных желёз.' },

  { code: 'ldh', name: 'ЛДГ', unit: 'Ед/л', panel: 'biochem', f: [120, 246], m: [120, 246],
    syn: ['лдг', 'ldh', 'лактатдегидрогеназа'],
    about: 'Фермент, который есть почти во всех тканях. Повышается при разрушении клеток — неспецифичный маркер.' },

  // ---------- Липиды ----------
  { code: 'cholesterol', name: 'Холестерин общий', unit: 'ммоль/л', panel: 'lipids', f: [0, 5.2], m: [0, 5.2], openLow: true,
    syn: ['холестерин общий', 'холестерин', 'cholesterol', 'cholesterol total'],
    about: 'Общий холестерин. Сам по себе мало о чём говорит — важен в связке с ЛПНП и ЛПВП.',
    high: 'Выше нормы. Риск для сосудов повышается, но решение о лечении принимают по ЛПНП и сердечно-сосудистому риску.' },

  { code: 'ldl', name: 'ЛПНП («плохой» холестерин)', unit: 'ммоль/л', panel: 'lipids', f: [0, 3.0], m: [0, 3.0], openLow: true,
    syn: ['лпнп', 'ldl', 'липопротеины низкой плотности', 'холестерин лпнп'],
    about: 'Тот самый «плохой» холестерин, который откладывается в сосудах. Главная цель при коррекции липидов.',
    high: 'Выше нормы. Для людей с сердечно-сосудистыми заболеваниями целевые значения ниже — обсуди с врачом.' },

  { code: 'hdl', name: 'ЛПВП («хороший» холестерин)', unit: 'ммоль/л', panel: 'lipids', f: [1.2, 2.5], m: [1.0, 2.5], openHigh: true,
    syn: ['лпвп', 'hdl', 'липопротеины высокой плотности'],
    about: '«Хороший» холестерин. Чем выше — тем лучше: он помогает выносить холестерин из сосудов.',
    low: 'Ниже нормы — защита сосудов слабее. Помогают движение, отказ от курения и нормальный вес.' },

  { code: 'triglycerides', name: 'Триглицериды', unit: 'ммоль/л', panel: 'lipids', f: [0, 1.7], m: [0, 1.7], openLow: true,
    syn: ['триглицериды', 'triglycerides', 'тг'],
    about: 'Форма «жирового депо» в крови. Растут от избытка сладкого и алкоголя, сильно зависят от того, ела ли ты перед сдачей.' },

  // ---------- Щитовидка ----------
  { code: 'tsh', name: 'ТТГ', unit: 'мЕд/л', panel: 'thyroid', f: [0.4, 4.0], m: [0.4, 4.0],
    syn: ['ттг', 'tsh', 'тиреотропный гормон'],
    about: 'Главный скрининг щитовидки. Работает «наоборот»: если щитовидка слабая, ТТГ растёт.',
    high: 'Выше нормы — щитовидка работает вяло (гипотиреоз). Часто проявляется усталостью, зябкостью, набором веса.',
    low: 'Ниже нормы — щитовидка активничает (тиреотоксикоз) или ты принимаешь гормоны. Нужен Т4 свободный.' },

  { code: 'ft4', name: 'Т4 свободный', unit: 'пмоль/л', panel: 'thyroid', f: [9, 22], m: [9, 22],
    syn: ['т4 свободный', 'ft4', 'свободный т4', 'тироксин свободный'],
    about: 'Активный гормон щитовидки. Смотрят вместе с ТТГ.' },

  { code: 'ft3', name: 'Т3 свободный', unit: 'пмоль/л', panel: 'thyroid', f: [2.6, 5.7], m: [2.6, 5.7],
    syn: ['т3 свободный', 'ft3', 'свободный т3'],
    about: 'Второй активный гормон щитовидки, отвечает за обмен энергии.' },

  // ---------- Гормоны ----------
  { code: 'insulin', name: 'Инсулин', unit: 'мкМЕ/мл', panel: 'hormones', f: [2.6, 24.9], m: [2.6, 24.9],
    syn: ['инсулин', 'insulin'],
    about: 'Гормон, который снижает сахар. Высокий инсулин при нормальном сахаре — признак инсулинорезистентности.' },

  { code: 'cortisol', name: 'Кортизол', unit: 'нмоль/л', panel: 'hormones', f: [138, 690], m: [138, 690],
    syn: ['кортизол', 'cortisol'],
    about: 'Гормон стресса. Сильно зависит от времени сдачи — сдают утром.' },

  { code: 'prolactin', name: 'Пролактин', unit: 'мЕд/л', panel: 'hormones', f: [67, 726], m: [53, 360],
    syn: ['пролактин', 'prolactin'],
    about: 'Гормон гипофиза. Растёт от стресса, недосыпа и некоторых лекарств — пересдают спокойно и утром.' },

  { code: 'testosterone', name: 'Тестостерон', unit: 'нмоль/л', panel: 'hormones', f: [0.3, 2.6], m: [8.6, 29.0],
    syn: ['тестостерон', 'testosterone'],
    about: 'Основной мужской половой гормон, у женщин тоже есть — в небольших количествах.' },

  { code: 'estradiol', name: 'Эстрадиол', unit: 'пмоль/л', panel: 'hormones', f: [68, 1269], m: [41, 159],
    syn: ['эстрадиол', 'estradiol', 'е2'],
    about: 'Основной женский половой гормон. Сильно меняется по фазам цикла — важен день сдачи.' },

  { code: 'fsh', name: 'ФСГ', unit: 'мМЕ/мл', panel: 'hormones', f: [1.8, 11.3], m: [1.4, 18.1],
    syn: ['фсг', 'fsh', 'фолликулостимулирующий гормон'],
    about: 'Гормон, который запускает созревание яйцеклеток у женщин и сперматозоидов у мужчин.' },

  { code: 'amh', name: 'АМГ (антимюллеров гормон)', unit: 'нг/мл', panel: 'hormones', f: [1.0, 10.0], m: [0.7, 19.0],
    syn: ['амг', 'amh', 'антимюллеров гормон', 'анти-мюллеров гормон'],
    about: 'Показывает запас яйцеклеток. Не меняется в течение цикла, поэтому удобен.' },

  // ---------- Витамины ----------
  { code: 'vitamin_d', name: 'Витамин D (25-OH)', unit: 'нг/мл', panel: 'vitamins', f: [20, 60], m: [20, 60],
    syn: ['витамин d', '25-oh витамин d', '25(oh)d', 'vitamin d', 'витамин д', '25-он витамин d'],
    about: 'Отвечает за кальций и кости, влияет на иммунитет. Дефицит — очень частая история в наших широтах.',
    low: 'Ниже нормы — дефицит. Восполняется добавками, но дозу лучше подобрать с врачом: слишком много тоже вредно.',
    high: 'Выше нормы — бывает при передозировке добавок. Может повышать кальций в крови.' },

  { code: 'b12', name: 'Витамин B12', unit: 'пг/мл', panel: 'vitamins', f: [187, 883], m: [187, 883],
    syn: ['витамин b12', 'b12', 'цианокобаламин', 'витамин в12'],
    about: 'Нужен для нервов и крови. Дефицит часто у тех, кто не ест мясо, и при проблемах с желудком.',
    low: 'Ниже нормы — может давать усталость, покалывание в руках и крупные эритроциты (высокий MCV).' },

  { code: 'folate', name: 'Фолаты (B9)', unit: 'нг/мл', panel: 'vitamins', f: [3.1, 20], m: [3.1, 20],
    syn: ['фолаты', 'фолиевая кислота', 'b9', 'folate', 'фолат'],
    about: 'Важен для деления клеток и кроветворения. Особенно важен при планировании беременности.' },

  { code: 'zinc', name: 'Цинк', unit: 'мкмоль/л', panel: 'vitamins', f: [10.7, 24.5], m: [10.7, 24.5],
    syn: ['цинк', 'zinc', 'zn'],
    about: 'Микроэлемент для иммунитета, кожи и заживления.' },

  // ---------- Минералы ----------
  { code: 'magnesium', name: 'Магний', unit: 'ммоль/л', panel: 'electrolytes', f: [0.66, 1.07], m: [0.66, 1.07],
    syn: ['магний', 'magnesium', 'mg'],
    about: 'Участвует в работе мышц и нервов, в сотнях реакций организма.' },

  { code: 'calcium', name: 'Кальций общий', unit: 'ммоль/л', panel: 'electrolytes', f: [2.15, 2.55], m: [2.15, 2.55],
    syn: ['кальций', 'calcium', 'кальций общий', 'ca'],
    about: 'Работает вместе с витамином D: без него кальций не усваивается.' },

  { code: 'potassium', name: 'Калий', unit: 'ммоль/л', panel: 'electrolytes', f: [3.5, 5.1], m: [3.5, 5.1],
    syn: ['калий', 'potassium', 'k'],
    about: 'Ключевой электролит для сердца и мышц.' },

  { code: 'sodium', name: 'Натрий', unit: 'ммоль/л', panel: 'electrolytes', f: [136, 145], m: [136, 145],
    syn: ['натрий', 'sodium', 'na'],
    about: 'Отвечает за водный баланс и давление.' },

  { code: 'phosphorus', name: 'Фосфор', unit: 'ммоль/л', panel: 'electrolytes', f: [0.87, 1.45], m: [0.87, 1.45],
    syn: ['фосфор', 'phosphorus', 'неорганический фосфор'],
    about: 'Работает в паре с кальцием, важен для костей.' },

  // ---------- Воспаление ----------
  { code: 'esr', name: 'СОЭ', unit: 'мм/ч', panel: 'inflammation', f: [2, 15], m: [1, 10],
    syn: ['соэ', 'esr', 'скорость оседания эритроцитов', 'роэ'],
    about: 'Скорость оседания эритроцитов — старый, но живучий маркер воспаления. Растёт неспецифично: от простуды до аутоиммунных состояний.' },

  { code: 'crp', name: 'С-реактивный белок (СРБ)', unit: 'мг/л', panel: 'inflammation', f: [0, 5], m: [0, 5], openLow: true,
    syn: ['срб', 'c-реактивный белок', 'crp', 'с-реактивный белок (crp)'],
    about: 'Один из самых чутких маркеров воспаления. Растёт в первые часы после начала инфекции.',
    high: 'Выше нормы — в организме идёт воспаление. Причины от насморка до аутоиммунных болезней; смотрят вместе с симптомами.' },
];

const GENERIC_HIGH = 'Выше референсного диапазона. Само по себе значение ничего не диагноситрует — покажи результат врачу вместе с остальными анализами.';
const GENERIC_LOW = 'Ниже референсного диапазона. Причины бывают разные; обсуди с врачом, нужны ли дообследование и повторная сдача.';

const SHORT_NAMES = {
  mcv: 'MCV', mch: 'MCH', mchc: 'MCHC', hba1c: 'HbA1c',
  ldl: 'ЛПНП', hdl: 'ЛПВП', crp: 'СРБ', vitamin_d: 'Витамин D', total_protein: 'Общий белок',
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Как одни и те же показатели называют разные лаборатории.
const EXTRA_SYNONYMS = {
  hemoglobin: ['hgb', 'hb', 'гемоглобин hgb', 'hemoglobin hgb', 'гемоглобин общий', 'концентрация гемоглобина'],
  rbc: ['красные клетки крови', 'эритроциты rbc', 'red blood cells'],
  hct: ['hct', 'гематокрит hct'],
  mcv: ['средний объем эритроцита', 'средний объем эритроцитов', 'mcv средний объем'],
  mch: ['mch среднее содержание гемоглобина', 'среднее содержание hb'],
  mchc: ['mchc средняя концентрация гемоглобина'],
  plt: ['plt', 'platelets', 'тромбоциты plt'],
  wbc: ['wbc', 'white blood cells', 'лейкоциты wbc'],
  neutrophils: ['нейтрофилы относительные', 'нейтрофилы процент'],
  lymphocytes: ['лимфоциты относительные'],
  monocytes: ['моноциты относительные'],
  eosinophils: ['эозинофилы относительные'],
  basophils: ['базофилы относительные'],
  esr: ['esr', 'скорость оседания', 'роэ'],
  ferritin: ['ferritin', 'ферритин сыворотки'],
  iron: ['fe', 'железо сыворотки', 'сывороточное железо', 'iron serum'],
  glucose: ['глюкоза натощак', 'сахар крови', 'глюкоза венозной крови', 'glucose fasting'],
  hba1c: ['гликированный гемоглобин', 'гликозилированный гемоглобин', 'a1c', 'гемоглобин гликированный'],
  creatinine: ['creatinine', 'креатинин сыворотки'],
  urea: ['urea', 'мочевина сыворотки'],
  uric_acid: ['uric acid', 'урат', 'мочевая кислота сыворотки'],
  alt: ['аланинаминотрансфераза', 'alt', 'аланинаминотрансфераза алт'],
  ast: ['аспартатаминотрансфераза', 'ast', 'аспартатаминотрансфераза аст'],
  ggt: ['гамма глутамилтрансфераза', 'ggt', 'гамма гт', 'гаммаглутамилтрансфераза'],
  alp: ['щелочная фосфатаза', 'alp', 'щф'],
  bilirubin_total: ['bilirubin total', 'билирубин'],
  bilirubin_direct: ['bilirubin direct', 'билирубин связанный', 'билирубин прямой'],
  total_protein: ['total protein', 'белок общий'],
  albumin: ['albumin', 'альбумин сыворотки'],
  amylase: ['amylase', 'альфа амилаза'],
  crp: ['crp', 'с реактивный белок', 'hs crp', 'с реактивный протеин', 'c реактивный белок'],
  ldh: ['ldh', 'лактатдегидрогеназа'],
  cholesterol: ['общий холестерин', 'cholesterol total', 'холестерин общий'],
  ldl: ['ldl', 'липопротеиды низкой плотности', 'холестерин лпнп', 'ldl холестерин'],
  hdl: ['hdl', 'липопротеиды высокой плотности', 'холестерин лпвп'],
  triglycerides: ['triglycerides', 'тг', 'триглицериды'],
  tsh: ['tsh', 'тиреотропный гормон', 'тиреотропин'],
  ft4: ['ft4', 'свободный т4', 'тироксин свободный'],
  ft3: ['ft3', 'свободный т3'],
  insulin: ['insulin'],
  cortisol: ['cortisol'],
  prolactin: ['prolactin'],
  testosterone: ['testosterone', 'тестостерон общий', 'testosterone total'],
  estradiol: ['estradiol', 'е2'],
  fsh: ['fsh', 'фолликулостимулирующий гормон'],
  amh: ['amh', 'анти мюллеров гормон', 'анти-мюллеров гормон'],
  vitamin_d: ['25 он витамин d', '25 oh d', 'витамин d 25 oh', '25 он d', 'витамин д', '25(oh)d'],
  b12: ['b12', 'в12', 'цианокобаламин', 'витамин в12'],
  folate: ['b9', 'фолиевая кислота', 'фолат', 'витамин b9'],
  zinc: ['zn', 'цинк сыворотки'],
  magnesium: ['mg', 'магний сыворотки'],
  calcium: ['ca', 'кальций общий', 'кальций сыворотки'],
  potassium: ['k', 'калий сыворотки'],
  sodium: ['na', 'натрий сыворотки'],
  phosphorus: ['неорганический фосфор', 'фосфор сыворотки'],
  reticulocytes: ['reticulocytes', 'ретикулоциты процент'],
};

const STOP_WORDS = new Set([
  'кровь', 'крови', 'сыворотка', 'сыворотки', 'плазма', 'плазмы', 'уровень', 'содержание',
  'концентрация', 'количество', 'показатель', 'анализ', 'исследование', 'единица', 'единиц',
  'венозной', 'капиллярной', 'общая', 'общее', 'общий', 'процент', 'относительные', 'абсолютные',
]);

const LEARNED = new Map();

export function setLearnedAliases(entries) {
  LEARNED.clear();
  for (const [raw, code] of entries) {
    const key = normalizeText(raw);
    if (key && code) LEARNED.set(key, code);
  }
}

export function learnAlias(raw, code) {
  const key = normalizeText(raw);
  if (key && code) LEARNED.set(key, code);
}

export const INDICATORS = RAW.map((item) => {
  const all = [item.name, ...(item.syn || []), ...(EXTRA_SYNONYMS[item.code] || [])];
  return {
    code: item.code,
    name: item.name,
    short: SHORT_NAMES[item.code] || item.name,
    unit: item.unit,
    panel: item.panel,
    ref: { female: item.f, male: item.m || item.f },
    openLow: Boolean(item.openLow),
    openHigh: Boolean(item.openHigh),
    synonyms: Array.from(new Set(all.map(normalizeText))).filter(Boolean),
    about: item.about || '',
    high: item.high || GENERIC_HIGH,
    low: item.low || GENERIC_LOW,
  };
});

export const BY_CODE = new Map(INDICATORS.map((i) => [i.code, i]));

export function normalizeName(value) {
  return normalizeText(value);
}

function tokenize(normalized) {
  return normalized.split(' ').filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

const TOKEN_WEIGHT = (() => {
  const df = new Map();
  for (const indicator of INDICATORS) {
    const seen = new Set();
    for (const synonym of indicator.synonyms) {
      for (const token of tokenize(synonym)) seen.add(token);
    }
    for (const token of seen) df.set(token, (df.get(token) || 0) + 1);
  }
  const weights = new Map();
  for (const [token, count] of df) weights.set(token, Math.log(1 + INDICATORS.length / count));
  return weights;
})();

function weightOf(token) {
  return TOKEN_WEIGHT.get(token) ?? Math.log(1 + INDICATORS.length);
}

function levenshtein(a, b, max = 1) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(prev[j] + 1, current[j - 1] + 1, prev[j - 1] + cost);
      current.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    prev = current;
  }
  return prev[b.length];
}

function scoreTokens(rawTokens, keyTokens) {
  if (!rawTokens.length || !keyTokens.length) return 0;
  const keySet = new Set(keyTokens);
  let matched = 0;
  let total = 0;

  for (const token of rawTokens) {
    const weight = weightOf(token);
    total += weight;

    if (keySet.has(token)) {
      matched += weight;
      continue;
    }

    let partial = 0;
    for (const key of keyTokens) {
      if (key.length >= 5 && token.length >= 5 && (key.startsWith(token) || token.startsWith(key))) {
        partial = Math.max(partial, 0.65);
      } else if (key.length >= 6 && token.length >= 6 && levenshtein(key, token, 1) <= 1) {
        partial = Math.max(partial, 0.8);
      }
    }
    matched += weight * partial;
  }

  return total ? matched / total : 0;
}

function scoreIndicator(normalized, tokens, indicator) {
  let best = 0;
  for (const synonym of indicator.synonyms) {
    if (normalized === synonym) return 1;
    const score = scoreTokens(tokens, tokenize(synonym));
    if (score > best) best = score;
  }
  return best;
}

// OCR путает латинские A, C, E, O, P, T с кириллицей: «ACT» вместо «АСТ».
const LATIN_TO_CYRILLIC = { a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у' };

function looksLatin(value) {
  return /^[a-z0-9\s().\-/]+$/i.test(value) && !/[а-яё]/i.test(value);
}

function foldLatin(value) {
  return value.replace(/[a-z]/g, (letter) => LATIN_TO_CYRILLIC[letter] || letter);
}

export function matchIndicatorDetailed(rawName, options = {}) {
  const result = matchIndicatorCore(rawName, options);
  if (result.indicator || !looksLatin(normalizeText(rawName))) return result;

  const folded = foldLatin(normalizeText(rawName));
  const retry = matchIndicatorCore(folded, options);
  return retry.indicator ? retry : result;
}

function matchIndicatorCore(rawName, { unit } = {}) {
  const normalized = normalizeText(rawName);
  if (!normalized) return { indicator: null, score: 0, alternatives: [] };

  const learned = LEARNED.get(normalized);
  if (learned && BY_CODE.has(learned)) {
    return { indicator: BY_CODE.get(learned), score: 1, learned: true, alternatives: [] };
  }

  const exact = INDICATORS.filter((indicator) => indicator.synonyms.includes(normalized));
  if (exact.length === 1) return { indicator: exact[0], score: 1, exact: true, alternatives: [] };
  if (exact.length > 1) {
    return { indicator: null, score: 1, ambiguous: true, alternatives: exact.map((item) => item.code) };
  }

  const tokens = tokenize(normalized);
  const scored = INDICATORS.map((indicator) => ({
    indicator,
    score: scoreIndicator(normalized, tokens, indicator),
  })).sort((a, b) => b.score - a.score);

  if (unit) {
    const normalizedUnit = normalizeText(unit);
    for (const item of scored) {
      const catalogUnit = normalizeText(item.indicator.unit);
      if (normalizedUnit && catalogUnit && (normalizedUnit === catalogUnit || catalogUnit.includes(normalizedUnit) || normalizedUnit.includes(catalogUnit))) {
        item.score += 0.05;
      }
    }
    scored.sort((a, b) => b.score - a.score);
  }

  const alternatives = scored.slice(0, 4).filter((item) => item.score > 0.42).map((item) => item.indicator.code);
  const [first, second] = scored;

  if (!first || first.score < 0.62) return { indicator: null, score: first?.score || 0, alternatives };

  if (second && first.score >= 0.9 && second.score >= first.score * 0.92) {
    return { indicator: null, score: first.score, ambiguous: true, alternatives };
  }

  return { indicator: first.indicator, score: first.score, alternatives };
}

export function matchIndicator(rawName, options) {
  return matchIndicatorDetailed(rawName, options).indicator;
}

export function panelOf(code) {
  return PANELS[BY_CODE.get(code)?.panel] || PANELS.biochem;
}

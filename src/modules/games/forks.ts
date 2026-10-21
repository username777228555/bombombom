/**
 * «Развилки»: moments where history could have gone otherwise. The player decides for the figure, Василий (AI proxy,
 * task `fork`) imagines the consequences and then tells what really happened — the reality only from `facts`
 * (knowledge-base cards sent with the request). A new fork: an entry here; `facts` must be existing ids.
 */
export interface Fork {
  id: string;
  /** Short title on the card. */
  title: string;
  /** «Осень 1611», «Июль 1906» — when the decision is taken. */
  when: string;
  /** Who the player is, as the model is told («Кузьма Минин, земский староста Нижнего Новгорода»). */
  role: string;
  /** Who the player is, as the screen shows it («Вы — Кузьма Минин»). */
  you: string;
  period: string;
  situation: string;
  /** Ready-made decisions to tap; the player can also write their own. */
  choices: string[];
  facts: string[];
}

export const FORKS: Fork[] = [
  {
    id: 'minin-1611',
    title: 'Кто спасёт Москву?',
    when: 'Осень 1611',
    role: 'Кузьма Минин, земский староста Нижнего Новгорода',
    you: 'Вы — Кузьма Минин, земский староста Нижнего Новгорода',
    period: 'c17',
    situation:
      'Москва занята польским гарнизоном, Первое ополчение распалось после гибели Прокопия Ляпунова, Новгород в руках шведов, ' +
      'царя нет. В Нижний Новгород приходят грамоты с призывом спасать страну. Горожане ждут, что скажет земский староста.',
    choices: ['Соберу деньги на новое ополчение и позову опытного воеводу', 'Предложу признать царём польского королевича Владислава', 'Будем отсиживаться за стенами, пока смута не уляжется'],
    facts: ['p-minin', 'p-pozharskiy', 'e-pervoe-opolchenie', 'e-vtoroe-opolchenie', 'e-zemskiy-sobor-1613', 't-smuta'],
  },
  {
    id: 'petr-1700',
    title: 'После Нарвы',
    when: 'Ноябрь 1700',
    role: 'Пётр I',
    you: 'Вы — Пётр I',
    period: 'c18',
    situation:
      'Под Нарвой 18-летний шведский король Карл XII с небольшим войском разгромил вашу армию, потеряна почти вся артиллерия. ' +
      'Северная война только началась, в Европе над русскими смеются, союзники ненадёжны.',
    choices: ['Попрошу у Карла мира и откажусь от выхода к Балтике', 'Переплавлю колокола на пушки и заново создам армию', 'Брошу шведов и пойду воевать с турками на юге'],
    facts: ['p-petr-i', 'e-narvskaya-bitva', 'e-severnaya-voyna', 'e-poltavskaya-bitva'],
  },
  {
    id: 'kutuzov-1812',
    title: 'Совет в Филях',
    when: 'Сентябрь 1812',
    role: 'М. И. Кутузов, главнокомандующий русской армией',
    you: 'Вы — Михаил Кутузов, главнокомандующий',
    period: 'c19',
    situation:
      'После Бородина армия обескровлена, Наполеон идёт к Москве. На военном совете в деревне Фили генералы спорят: дать ' +
      'новое сражение у стен древней столицы или отступить. Решение за вами.',
    choices: ['Дам бой у стен Москвы — сдавать столицу нельзя', 'Оставлю Москву, но сохраню армию', 'Предложу Наполеону перемирие'],
    facts: ['p-kutuzov', 'e-borodinskoe-srazhenie-1812', 'e-otechestvennaya-voyna-1812'],
  },
  {
    id: 'aleksandr-1856',
    title: 'После Крымской войны',
    when: 'Весна 1856',
    role: 'Александр II',
    you: 'Вы — Александр II, недавно взошедший на престол',
    period: 'c19',
    situation:
      'Россия проиграла Крымскую войну: по Парижскому миру ей запрещено держать флот на Чёрном море. Армия и хозяйство ' +
      'отстали от Европы, в деревнях волнения, а дворяне боятся потерять землю и работников.',
    choices: ['Освобожу крестьян с землёй за выкуп', 'Освобожу крестьян, но без земли', 'Оставлю всё как есть и займусь только армией'],
    facts: ['p-aleksandr-ii', 'e-krymskaya-voyna-1853', 'e-otmena-krepostnogo-prava-1861', 't-redaktsionnye-komissii', 't-vremennoobyazannye-krestyane'],
  },
  {
    id: 'nikolay-1905',
    title: 'Всеобщая стачка',
    when: 'Октябрь 1905',
    role: 'Николай II',
    you: 'Вы — Николай II',
    period: 'c20',
    situation:
      'Страну охватила всеобщая политическая стачка: стоят железные дороги и заводы, не работают телеграф и банки. После ' +
      'Кровавого воскресенья и поражения в войне с Японией доверие к власти подорвано. Витте советует уступить, другие — ' +
      'подавить силой.',
    choices: ['Дарую гражданские свободы и законодательную Думу', 'Назначу военного диктатора и подавлю стачку', 'Отрекусь от престола'],
    facts: ['p-nikolay-ii', 'e-krovavoe-voskresenye', 'e-oktyabrskaya-stachka-1905', 'e-manifest-17-oktyabrya', 'e-dekabrskoe-vosstanie-1905'],
  },
  {
    id: 'stolypin-1906',
    title: 'Порядок или реформы?',
    when: 'Июль 1906',
    role: 'П. А. Столыпин, только что назначенный председателем Совета министров',
    you: 'Вы — Пётр Столыпин, новый председатель Совета министров',
    period: 'c20',
    situation:
      'Первая Дума распущена, в деревнях жгут помещичьи усадьбы, эсеры устраивают теракты. Нужно навести порядок и решить, ' +
      'что делать с крестьянским вопросом.',
    choices: ['Введу военно-полевые суды и разрешу выход из общины', 'Раздам крестьянам помещичьи земли', 'Созову новую Думу и уступлю ей власть'],
    facts: ['p-stolypin', 'e-agrarnaya-reforma-stolypina', 't-voenno-polevye-sudy', 'e-i-gosduma', 'e-ii-gosduma'],
  },
];

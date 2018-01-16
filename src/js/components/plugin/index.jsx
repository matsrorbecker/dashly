import $ from 'jquery'

((Dashboard, React) => {

	const GUI = Dashboard.GUI
	const moment = Dashboard.moment

	class Application extends Dashboard.Application {
		constructor({config}) {
			super()

			this.state = {
				config: JSON.parse(config.configEditor).config,
				showPubTime: true, // TODO: Detta ska vara konfigurerbart
				items: []
			}

			this.on('rss:update', items => {
				this.setState({'items': items})
			})
		}

		componentDidMount() {
			this.send('rss:get')
		}

		render() {

			const listItems = this.state.items.map(item => {
				// Visa datum om nyheten är från annan dag, annars bara klockslag
				const date = moment().isSame(item.pubDate, 'day') ? '' : item.pubDate.format('D/M') + ' '
				const pubTime = date + item.pubDate.format('HH.mm')
				return {
					id: item.link,
					title: `${this.state.showPubTime ? pubTime + ': ' : ''}${item.title}`,
					onClick: () => window.open(item.link),
				}
			})

			return (
				<GUI.Wrapper className="@plugin_bundle_class">
					<GUI.Title text={this.state.config.title} />
					<GUI.List items={listItems} />
				</GUI.Wrapper>
			)
		}
	}


	class Agent extends Dashboard.Agent {
		constructor({config}) {
			console.log('Agent skapad!')
			super()

			const pluginConfig = JSON.parse(config.configEditor).config
			console.log(pluginConfig)
			this.updateInterval = (Number(pluginConfig.updateInterval) >= 60 ? pluginConfig.updateInterval : 60) * 1000 // Uppdatera högst en gång/minut
			this.feeds = (pluginConfig.feeds ? pluginConfig.feeds : []) // TODO: hämta ev feeds från local storage
			this.update()

			this.on('rss:get', () => {
				console.log('Struntar i detta just nu...')
				// this.store('rss', response => {
				// 	this.send('rss:update', response.data)
				// })
			})

			//this.store('myKeyValue', { foo: 'bar' })
			//this.test()
		}

		test() {
			const feeds = [
				'https://www.dn.se/rss',
				'https://feeds.expressen.se/nyheter/',
				'https://www.aftonbladet.se/nyheter/rss.xml',
				'https://www.svd.se/?service=rss'
			]

			Promise.all(feeds.map(feed => {
				console.log('Hämtar från ->', feed)
				return this.request(feed)
			}))
			.then(responses => {
				Promise.all(responses.map(response => {
					return response.text()
				}))
				.then(results => {
					results.forEach(result => {
						const xml = $.parseXML(result)
						const link = $('link:first', xml).text()
						console.log('Fick svar från ->', link)
					})
				})
			})
			setTimeout(() => this.test(), this.updateInterval)
		}

		update() {
			this.fetch()
			.then(results => this.parseAll(results))
			.then(newItems => {
				const items = [].concat.apply([], newItems).sort((a, b) => {
					return b.pubDate.unix() - a.pubDate.unix()
				})
				// TODO: Dessa items ska läggas till dem som hämtats tidigare
				// och hela listan ska sorteras innan den lagras och skickas
				//this.store('rss', { items: data })
				this.send('rss:update', items)
			})
			.catch(reason => console.error(reason))
			this.timeoutID = setTimeout(() => this.update(), this.updateInterval)
		}

		fetch() {
			return Promise.all(this.feeds.map(feed => {
				console.log('Hämtar', feed.url)
				return this.request(feed.url)
			}))
			.then(responses => {
				return Promise.all(responses.map(response => {
					return response.text()
				}))
			})
		}

		parseAll(xmlDocs) {
			//console.log(xmlDocs)
			return Promise.all(xmlDocs.map(xmlDoc => this.parseOne(xmlDoc)))
		}

		parseOne(xmlDoc) {
			return new Promise((resolve) => {
				const items = []
				const regex = /<!\[CDATA\[|\]\]\>|&quot;/g // TODO: Byt ut &quot;, &amp; etc mot rätt tecken
				const xml = $.parseXML(xmlDoc) // TODO: Hantera fel
				$('item', xml).each((i, element) => {
					items.push({
						title: $('title', element).text().replace(regex, ''),
						link: $('link', element).text(),
						description: $('description', element).text().replace(regex, ''),
						pubDate: moment(new Date($('pubDate', element).text()))
					})
				})
				resolve(items)
			})
		}

		close() {
			console.log('Farväl!')
			clearTimeout(this.timeoutID)
		}

	}


	class Settings extends Dashboard.Settings {
		plugin() {
			// return (
			// 	<GUI.Wrapper className="@plugin_bundle_class">
			// 		<GUI.ConfigInput name="Överskrift" ref="pluginTitle" value="" />
			// 		<GUI.ConfigInput name="Uppdateringsintervall (sekunder, minvärde 60)" ref="updateInterval" validation={['required', 'numerical']} value="" />
			// 		<GUI.ConfigInput name="Defaultflöden (separera med komma)" ref="defaultFeeds" value="" />
			// 	</GUI.Wrapper>
			// )
			return <GUI.ConfigEditor ref="configEditor" />
		}
	}

	Dashboard.register({
		bundle: "@plugin_bundle",
		application: Application,
		agent: Agent,
		settings: Settings
	})

})(window.Dashboard, window.React)

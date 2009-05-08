(function(){

if (window.bookmarkletAlreadyExecuted)
  return;
window.bookmarkletAlreadyExecuted = true;

var isIPhoneView = (window.location.pathname.indexOf('/iphone') == 0);

function $(id) {
  return document.getElementById(id);
}

function $x(xpath, context) {
  context = context || document;
  var retval = [];
  var result = document.evaluate(xpath, context, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
  var node;
  while ((node = result.iterateNext()) != null)
    retval.push(node);
  return retval;
}

function doXMLHttpRequest(options) {
  var client = new XMLHttpRequest();
  if (typeof options.data == 'string') {
    var method = 'POST';
    var data = options.data;
  }
  else {
    var method = 'GET';
    var data = null;
  }
  client.open(method, options.uri);
  if (typeof options.header == 'object')
    for (var name in options.header)
      client.setRequestHeader(name, options.header[name]);

  var timeoutId = null;
  if (typeof options.onError == 'function') {
    var timeoutHandler = function() {
      client.onreadystatechange = null;
      client.abort();
      options.onError(client);
    };
    var timeout = 1000 * 60 * 5;
    timeoutId = window.setTimeout(timeoutHandler, timeout);
  }

  client.onreadystatechange = function() {
    if (timeoutId)
      window.clearTimeout(timeoutId);
    if (client.readyState == 4) {
      if (client.status >= 200 && client.status < 300) {
        if (typeof options.onLoad == 'function')
          options.onLoad(client);
      }
      else {
        if (typeof options.onError == 'function')
          options.onError(client);
      }
    }
    else if (timeoutId)
      timeoutId = window.setTimeout(timeoutHandler, timeout);
  };

  client.send(data);
}

function StyleSheet() {
  this.style = document.createElement('style');
  this.style.type = 'text/css';
  $x('//head')[0].appendChild(this.style);
}

StyleSheet.prototype.add = function(rule) {
  this.style.sheet.insertRule(rule, 0);
};

function Cover(opacity) {
  this.element = document.createElement('div');
  this.element.className = 'cover';
  this.element.style.opacity = opacity;
  this.clickListener = null;
}

Cover.prototype.show = function() {
  var self = this;
  this.refresh();
  this.resizeListener = function(event) {
    self.refresh();
  };
  document.body.appendChild(this.element);
  window.addEventListener('resize', this.resizeListener, false);
};

Cover.prototype.hide = function() {
  window.removeEventListener('resize', this.resizeListener, false);
  document.body.removeChild(this.element);
};

Cover.prototype.refresh = function() {
  this.element.style.top = postsNode.offsetTop + 'px';
  this.element.style.height = (paginationNode.offsetTop + paginationNode.offsetHeight - postsNode.offsetTop) + 'px';
}

Cover.prototype.onClick = function(listener) {
  if (this.clickListener) {
    this.element.removeEventListener('click', this.clickListener, false);
    this.clickListener = null;
  }
  if (typeof listener == 'function') {
    this.element.addEventListener('click', listener, false);
    this.clickListener = listener;
  }
};

function Form(element) {
  this.element = element;
}

Form.urlencode = function(s) {
  return encodeURIComponent(s).replace('%20', '+');
};

Form.generateBoundary = function() {
  var length = 20;
  var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'()+_,-./:=?";
  var retval = '';
  for (var i = 0; i < length; i++)
    retval += chars.charAt(Math.floor(Math.random() * chars.length));
  return retval;
};

Form.prototype.extractData = function() {
  var form = this.element;
  var retval = [];
  var submitAppeared = false;
  for (var i = 0; i < form.length; i++) {
    var elem = form.elements[i];
    if (elem.disabled || ((elem.type == 'submit' || elem.type == 'image') && submitAppeared))
      continue;
    if (elem.type == 'submit' || elem.type == 'image')
      submitAppeared = true;
    if (!elem.name)
      continue;
    switch (elem.type) {
    case 'text':
    case 'password':
    case 'submit':
    case 'hidden':
    case 'image':
    case 'button':
    case 'textarea':
      retval.push({ name: elem.name, value: elem.value });
      break;
    case 'checkbox':
    case 'radio':
      if (elem.checked)
        retval.push({ name: elem.name, value: elem.value });
      break;
    case 'select-multiple':
      if (elem.selectedIndex != -1)
        for (var i = elem.selectedIndex; i < elem.length; i++)
          if (elem.options[i].selected)
            retval.push({ name: elem.name, value: elem.options[i].value });
      break;
    case 'select-one':
      if (elem.selectedIndex != -1)
        retval.push({ name: elem.name, value: elem.options[elem.selectedIndex].value });
      break;
    }
  }
  return retval;
};

Form.prototype.submit = function() {
  var form = this.element;
  var data = this.extractData();
  if (form.enctype == 'multipart/form-data') {
    for (;;) {
      var boundary = Form.generateBoundary();
      if (data.every(function(e) { return e.value.indexOf(boundary) == -1 }))
        break;
    }
    var contentType = 'multipart/form-data; boundary="' + boundary + '"';
    var dashBoundary = '--' + boundary;
    var delimiter = '\r\n' + dashBoundary;
    var body = dashBoundary + '\r\n' + data.map(function(e) {
      return 'Content-Disposition: form-data; name="' + e.name + '"\r\n\r\n' + e.value;
    }).join(delimiter + '\r\n') + delimiter + '--';
  }
  else {
    var contentType = 'application/x-www-form-urlencoded';
    var body = data.map(function(e) {
      return Form.urlencode(e.name) + '=' + Form.urlencode(e.value);
    }).join('&');
  }

  doXMLHttpRequest({
    uri: form.action,
    header: { 'Content-Type': contentType },
    data: body,
    onLoad: this.onLoad,
    onError: this.onError
  });
};

Form.prototype.show = function() {
  var self = this;
  $x('.//div[@id="left_column"]', this.element)[0].style.width = '400px';
  if (!this.submitListener) {
    this.submitListener = function(event) {
      self.hide();
      self.submit();
      event.preventDefault();
    };
    this.element.addEventListener('submit', this.submitListener, false);
  }
  this.container = document.createElement('div');
  this.container.className = 'form_container';
  this.container.style.top = window.pageYOffset + 'px';
  this.container.appendChild(this.element);
  this.cover = new Cover(0.5);
  this.cover.show();
  document.body.appendChild(this.container);
  this.cover.onClick(function(event) { self.hide(); });
  this.scrollListener = function(event) {
    if (self.container.offsetTop > window.pageYOffset + window.innerHeight
      || self.container.offsetTop + self.container.offsetHeight < window.pageYOffset)
      self.container.style.top = window.pageYOffset + 'px';
  };
  window.addEventListener('scroll', this.scrollListener, false);
};

Form.prototype.hide = function() {
  if (isIPhoneView)
    return;
  document.body.removeChild(this.container);
  this.cover.hide();
  window.removeEventListener('scroll', this.scrollListener, false);
};

function Pager() {
  var self = this;
  if (isIPhoneView) {
    this.paginationNode = $('footer');
    this.postsExp = /<ul id="posts">([\s\S]*)<\/ul>\s*<div id="footer">/;
  }
  else {
    this.paginationNode = $('pagination');
    this.postsExp = /<!-- Posts -->\s*<ol id="posts" ?>([\s\S]*)<\/ol>\s*<!-- No posts found -->/;
  }
  this.paginationNode = isIPhoneView ? $('footer') : $('pagination');
  this.nextLinkNode = $x('./a[contains(text(),"Next page")]', this.paginationNode)[0];
  this.curUri = window.location.pathname;
  if (window.location.hash) {
    var range = document.createRange();
    range.selectNodeContents($('posts'));
    range.deleteContents();
    range.detach();
    this.nextUri = decodeURIComponent(window.location.hash.slice(1));
    this.minPostId = Infinity;
    window.setTimeout(function() { self.loadNext(); }, 0);
  }
  else {
    this.nextUri = this.nextLinkNode.href;
    var posts = $('posts');
    $x('./text()', posts).forEach(function(text) { posts.removeChild(text); });
    var last = $x('id("posts")/*[last()]')[0];
    this.minPostId = Number(last.id.match(/\d+/)[0]);
  }
  this.auto = true;
  this.inProgress = false;
  this.failure = false;
  this.nextLinkNode.addEventListener('click', function(event) {
    if (self.loadNext())
      event.preventDefault();
  }, false);
  window.addEventListener('scroll', Pager.scrollListener, false);
}

Pager.scrollListener = function() {
  if (window.pageYOffset == 0) {
    var posts = $('posts');
    var padding = $x('./*[@class="padding"]', posts)[0];
    if (padding)
      posts.removeChild(padding);
  }
};

Pager.prototype.loadNext = function() {
  var self = this;
  if (this.inProgress || !this.nextUri)
    return false;
  this.inProgress = true;
  this.failure = false;
  doXMLHttpRequest({
    uri: this.nextUri,
    onLoad: function(response) {
      var text = response.responseText;
      var div = document.createElement('div');
      div.innerHTML = text.match(self.postsExp)[1];
      var postsNode = $('posts');
      var newPosts = $x('./*', div);
      for (var i = newPosts.length - 1; i >= 0; i--)
        if (newPosts[i].id.match(/(\d+)/) != null && Number(RegExp.$1) >= self.minPostId)
          break;

      if (i == newPosts.length - 1)
        window.setTimeout(function() { self.loadNext(); }, 0);
      else {
        if (i != -1)
          newPosts.splice(0, i + 1);
        self.minPostId = Number(newPosts[newPosts.length - 1].id.match(/\d+/)[0]);
        var fragment = document.createDocumentFragment();
        newPosts.forEach(function(post) { fragment.appendChild(post); });
        postsNode.appendChild(fragment);
        window.setTimeout(function() { self.removePassedPosts(); }, 0);
      }
      var nextNodeExp = /<a href="([^"]*)"[^>]*>Next page &#8594;<\/a>/; //"
      var nextUri = (text.match(nextNodeExp) == null) ? null : (self.nextLinkNode.href = RegExp.$1);
      window.location.hash = encodeURIComponent(self.curUri.match(/(?:http:\/\/www\.tumblr\.com)?(\/.*)/)[1]);
      self.curUri = self.nextUri;
      self.nextUri = nextUri;
      self.inProgress = false;
    },
    onError: function() {
      self.inProgress = false;
      self.failure = true;
    }
  });
  return true;
};

Pager.prototype.removePassedPosts = function() {
  var postsNode = $('posts');
  var posts = $x('id("posts")/*[contains(@class,"post")][not(contains(@class,"controls"))]');
  var maxPostNum = 23;
  var removedNum = Math.max(posts.length - maxPostNum, 0);
  if (removedNum > 0) {
    var remain = posts[removedNum];
    var removed = [];
    var elem;
    for (var i = 0; (elem = postsNode.childNodes[i]) != remain; i++)
      removed.push(elem);
    var padding = document.createElement('li');
    padding.className = 'padding';
    postsNode.insertBefore(padding, postsNode.firstChild);
    removed.forEach(function(elem) { padding.appendChild(elem); });
    padding.style.height = (remain.offsetTop - padding.offsetTop) + 'px';
    var range = document.createRange();
    range.selectNodeContents(padding);
    range.deleteContents();
    range.detach();
  }
};

Pager.prototype.enableAuto = function() {
  this.auto = true;
};

Pager.prototype.disableAuto = function() {
  this.auto = false;
};

function PostIterator() {
  var self = this;
  this.refresh();
  window.addEventListener('scroll', function(event) {
    self.refresh();
  }, false);
}

PostIterator.prototype.getCurrent = function() {
  return this.current;
};

PostIterator.prototype.prev = function() {
  var xpath = '(preceding-sibling::*[contains(@class,"post")][not(contains(@class,"controls"))])[last()]';
  if (this.current) {
    var prev = $x(xpath, this.current)[0];
    if (prev) {
      this.setCurrent(prev);
      return prev;
    }
  }
  return null;
};

PostIterator.prototype.next = function() {
  var xpath = 'following-sibling::*[contains(@class,"post")][not(contains(@class,"controls"))]';
  if (this.current) {
    var followings = $x(xpath, this.current);
    var next = followings[0];
    if (next) {
      this.setCurrent(next);
      if (followings.length <= 10)
        pager.loadNext();
      return next;
    }
  }
  return null;
};

PostIterator.prototype.setCurrent = function(current) {
  if (this.current)
    this.current.style.backgroundColor = '#fff';
  this.current = current;
  if (actionsEnabled && this.current)
    this.current.style.backgroundColor = '#cfc';
};

PostIterator.prototype.refresh = function() {
  var posts = $x('id("posts")/*[contains(@class,"post")][not(contains(@class,"controls"))]');
  for (var i = 0; i <posts.length; i++)
    if (posts[i].offsetTop >= window.pageYOffset
      || posts[i].offsetTop + posts[i].offsetHeight >= window.pageYOffset + window.innerHeight / 2)
      break;
  this.setCurrent(posts[i]);
  if (posts.length - i <= 10)
    pager.loadNext();
};

function ActionDispatcher() {
  this.topLeft = this.topRight = this.buttomLeft = this.bottomRight = ActionDispatcher.actions.nothing;
}

ActionDispatcher.actions = [
  {
    name: 'prev',
    longName: 'previous post',
    action: function() {
      var current = postIterator.getCurrent();
      if (current.offsetTop < window.pageYOffset)
        window.scrollTo(0, current.offsetTop);
      else {
        var prev = postIterator.prev();
        if (prev)
          window.scrollTo(0, prev.offsetTop);
        else
          window.scrollTo(0, 0);
      }
    }
  },
  {
    name: 'next',
    longName: 'next post',
    action: function() {
      var current = postIterator.getCurrent();
      if (current.offsetTop > window.pageYOffset)
        window.scrollTo(0, current.offsetTop);
      else {
        var next = postIterator.next();
        if (next)
          window.scrollTo(0, next.offsetTop);
        else
          window.scrollTo(0, document.body.offsetHeight);
      }
      Pager.scrollListener();
    }
  },
  {
    name: 'reblog',
    longName: 'reblog',
    action: function() {
      (new Post(postIterator.getCurrent())).reblog();
    }
  },
  {
    name: 'form',
    longName: 'reblog-form',
    action: function() {
      (new Post(postIterator.getCurrent())).reblog(true);
    }
  },
/*
  {
    name: 'comment',
    longName: 'reblog with comment',
    action: function() {
    }
  },
  {
    name: 'private',
    longName: 'reblog as private',
    action: function() {
    }
  },
  {
    name: 'like',
    longName: 'like',
    action: function() {
    }
  },
  {
    name: 'open',
    longName: 'open the post',
    action: function() {
    }
  },
  {
    name: 'source',
    longName: 'open the source',
    action: function() {
    }
  },
  {
    name: 'choice',
    longName: 'choice',
    action: function() {
    }
  },
*/
  {
    name: 'nothing',
    longName: 'nothing',
    action: function() {}
  }
];

ActionDispatcher.actions.forEach(function(action) {
  ActionDispatcher.actions[action.name] = action;
});

ActionDispatcher.prototype.set = function(topLeft, topRight, bottomLeft, bottomRight) {
  this.topLeft = ActionDispatcher.actions[topLeft];
  this.topRight = ActionDispatcher.actions[topRight];
  this.bottomLeft = ActionDispatcher.actions[bottomLeft];
  this.bottomRight = ActionDispatcher.actions[bottomRight];
};

ActionDispatcher.prototype.enable = function() {
  if (this.enabled)
    return;
  var self = this;
  this.enabled = true;
  this.cover = new Cover(0.0);
  this.cover.show();
  this.cover.onClick(function(event) {
    var x = event.clientX;
    var y = event.clientY - window.pageYOffset;
    if (x < window.innerWidth / 2) {
      if (y < window.innerHeight / 2)
        self.topLeft.action();
      else
        self.bottomLeft.action();
    }
    else {
      if (y < window.innerHeight / 2)
        self.topRight.action();
      else
        self.bottomRight.action();
    }
    event.stopPropagation();
    event.preventDefault();
  });
};

ActionDispatcher.prototype.disable = function() {
  if (!this.enabled)
    return;
  this.enabled = false;
  this.cover.hide();
};

function Post(element) {
  this.element = element;
}

Post.prototype.reblog = function(popup) {
  var post = this.element;
  var control = isIPhoneView ?
    $(post.id.replace('post', 'post_controls')) : $x('./*[@class="post_controls"]', post)[0];
  if (control && control.innerHTML.match(/(\/reblog\/\w+\/\w+)/))
    reblog(RegExp.$1, popup);
};

function reblog(uri, popup) {
  if (popup && isIPhoneView) {
    window.open(uri)
    return;
  }
  doXMLHttpRequest({
    uri: uri,
    onLoad: function(response) {
      var formExp = /<form action="\/reblog[\s\S]*?<\/form>/; //"
      var div = document.createElement('div');
      div.innerHTML = response.responseText.match(formExp)[0];
      var form = new Form(div.firstChild);
      form.onError = function() {
        if (window.confirm('Failed to reblog the post. Retry?'))
          form.submit();
      };
      if (popup)
        form.show();
      else
        form.submit();
    },
    onError: function() {
      if (window.confirm('Failed to reblog the post. Retry?'))
        reblog(uri, popup);
    }
  });
}

function Config() {
}

Config.prototype.show = function() {
  var self = this;
  this.cover = new Cover(0.5);
  this.cover.show();
  this.element = document.createElement('div');
  this.element.className = 'menu';
  this.element.style.position = 'absolute';
  this.element.style.top = '0';
  this.element.style.left = '0';
  this.element.style.backgroundColor = '#fff';
  this.element.innerHTML =
    '<form action="#">'
    + '<fieldset>'
    +   '<input type="checkbox" name="enable_actions" value="enable_actions"' + (actionsEnabled ? ' checked="checked"' : '') + '/>'
    +   '<label for="enable_actions">execute action when each section is tapped</label>'
    +   '<table>'
    +     [ 'top left', 'top right', 'bottom left', 'bottom right' ].map(function(section,i) {
            var name = section.replace(/ ./, function(s) { return s.charAt(1).toUpperCase(); });
            return '<tr><td><label for="' + name + '">' + section + '</label></td><td><select name="' + name + '">'
              + ActionDispatcher.actions.map(function(action,j) {
                  return '<option value="' + action.name + '"'
                    + (actionDispatcher[name] == action ? ' selected="selected"' : '') + '>' + action.longName + '</option>';
                }).join('')
              + '</select></td></tr>';
          }).join('')
    +   '</table>'
    + '</fieldset>'
    + '<input type="submit" value="OK"/>'
    + '<input type="button" name="cancel" value="Cancel"/>'
    +'</form>';
  var form = this.element.firstChild;
  form.addEventListener('submit', function(event) {
    event.preventDefault();
    actionsEnabled = form.enable_actions.checked;
    if (actionsEnabled)
      actionDispatcher.enable();
    else
      actionDispatcher.disable();
    actionDispatcher.set(form.topLeft.value, form.topRight.value, form.bottomLeft.value, form.bottomRight.value);
    postIterator.refresh();
    self.hide();
  }, false);
  $x('./input[@name="cancel"]', form)[0].addEventListener('click', function(event) {
    self.hide();
  }, false);
  document.body.appendChild(this.element);
};

Config.prototype.hide = function() {
  document.body.removeChild(this.element);
  this.cover.hide();
};

var styleSheet = new StyleSheet();
styleSheet.add('.cover {' + [
  'position: absolute',
  'top: 0',
  'left: 0',
  'width: 100%',
  'background-color: #000',
'}'].join(';'));
styleSheet.add('.form_container {' + [
  'position: absolute',
  'left: 0',
  'width: 100%',
  'background-color: #fff',
'}'].join(';'));
styleSheet.add('.form_container input { max-width: 80%; }');
styleSheet.add('.form_container .wide { width: 100%; }');
styleSheet.add('.form_container img { max-width: 100%; }');
styleSheet.add('.form_container div[id=right_column] { background-color: #777; }');

if (!isIPhoneView) {
  Ajax.PeriodicalUpdater.prototype.onTimerEvent = function() {};
  document.body.onclick = null;

  [ $('header_container'), $('content_top'), $('right_column'), $('content_bottom'), $('footer') ]
    .forEach(function(node) { node.parentNode.removeChild(node); });

  $('pagination').style.padding = '0';
  $('container').style.width = '665px';
  $('container').style.padding = '0';
  $('container').style.overflowX = 'hidden';
  $x('//meta[@name="viewport"]')[0].content = 'width = 665';
}

var postsNode = $('posts');
var paginationNode = isIPhoneView ? $('footer') : $('pagination');
var actionsEnabled = false;

var pager = new Pager();
var postIterator = new PostIterator();
var actionDispatcher = new ActionDispatcher();
actionDispatcher.set('form', 'prev', 'reblog', 'next');
var config = new Config();

if (isIPhoneView) {
  var showMenuNode = document.createElement('div');
  var showMenuButton = document.createElement('input');
  showMenuButton.type = 'button';
  showMenuButton.name = 'show_menu';
  showMenuButton.value = 'Preferences';
  showMenuButton.addEventListener('click', function(event) {
    config.show();
  }, false);
  showMenuNode.appendChild(showMenuButton);
  postsNode.parentNode.insertBefore(showMenuNode, postsNode);
}

(isIPhoneView ? $('posts') : $('left_column')).addEventListener('click', function(event) {
  var target = event.target;

  if ($x('ancestor-or-self::a[@href="#"] | ancestor::form', target)[0])
    return;

  if (target.tagName == 'A') {
    if (target.href.indexOf('http://www.tumblr.com/reblog/') == 0)
      reblog(target.href, true);
    else
      window.open(target.href);
    event.preventDefault();
    return;
  }

  if (target.tagName == 'BUTTON' && target.onclick.toString().match(/location\.href\s*=\s*['"]([\/\w]+)['"]/)) { //"
    reblog(RegExp.$1, true);
    event.stopPropagation();
    return;
  }

  var post = $x('ancestor-or-self::li[parent::*[@id="posts"]]', target)[0];
  if (post) {
    (new Post(post)).reblog();
    event.preventDefault();
  }
}, true);

})();
